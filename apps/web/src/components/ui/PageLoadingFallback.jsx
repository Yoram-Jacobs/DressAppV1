import React from 'react';

export function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 w-full">
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        {/* Inner brand emblem */}
        <div className="absolute w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
          DA
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">
        Loading...
      </p>
    </div>
  );
}

export default PageLoadingFallback;
