import React from 'react';

export function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] p-8 w-full">
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div className=" w-20 h-20 rounded-full border-4 border-primary-shadow border-t-primary-brand animate-spin" />
        {/* Inner brand emblem */}
        <div className="absolute w-10 h-10 rounded-full bg-primary-shadow flex p-5 items-center justify-center text-primary-brand font-bold text-[20px]">
          DA
        </div>
      </div>
      <p className="mt-4 text-center text-[14px] font-bold text-primary-brand animate-pulse">
        Loading...
      </p>
    </div>
  );
}

export default PageLoadingFallback;
