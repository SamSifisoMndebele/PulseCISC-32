// PulseCISC-32 Responsive Viewport Container
// Supports Mobile (Portrait & Landscape), Tablet, and Desktop viewports
import React from 'react';

interface ScreenSizeGuardProps {
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
}

export const ScreenSizeGuard: React.FC<ScreenSizeGuardProps> = ({
  children,
}) => {
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#070a10] flex flex-col">
      <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
};
