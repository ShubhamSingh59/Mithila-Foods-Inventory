// src/components/common/Skeleton.jsx
import React from "react";

export default function Skeleton({ width, height = "20px", className = "", style = {} }) {
  return (
    <div 
      className={`skeleton ${className}`} 
      style={{ 
        width: width, 
        height: height, 
        ...style 
      }} 
    />
  );
}