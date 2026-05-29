import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if the user needs onboarding by calling the backend
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
          const res = await fetch(`${apiUrl}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (res.ok) {
            const userData = await res.json();
            // Only go to discover if onboarding IS completed
            if (userData.data.onboarding_completed) {
              return NextResponse.redirect(`${origin}/discover`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to check onboarding status:", err);
      }

      // DEFAULT: send to onboarding (safe default for new users AND failed checks)
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // If there's an error or no code, redirect back to login with an error
  return NextResponse.redirect(`${origin}/login?error=Verification_Failed`);
}
