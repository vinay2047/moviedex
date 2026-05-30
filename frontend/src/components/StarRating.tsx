"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const SIZES = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export default function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;
  const sizeClass = SIZES[size];

  const handleClick = (starValue: number) => {
    if (!readonly && onChange) {
      onChange(starValue);
    }
  };

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const halfStar = star - 0.5;
        const isFilled = displayValue >= star;
        const isHalfFilled = !isFilled && displayValue >= halfStar;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`relative ${readonly ? "cursor-default" : "cursor-pointer"} transition-transform ${
              !readonly ? "hover:scale-110" : ""
            }`}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onClick={() => handleClick(star)}
          >
            {/* Empty star */}
            <svg
              className={`${sizeClass} text-surface-600`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {/* Filled overlay */}
            {(isFilled || isHalfFilled) && (
              <svg
                className={`${sizeClass} absolute inset-0 text-accent-400 transition-colors`}
                fill="currentColor"
                viewBox="0 0 20 20"
                style={
                  isHalfFilled
                    ? { clipPath: "inset(0 50% 0 0)" }
                    : undefined
                }
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </button>
        );
      })}
      {typeof value === 'number' && (
        <span className="ml-1.5 text-sm font-medium text-surface-300">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
