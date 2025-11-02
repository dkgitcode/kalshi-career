"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, type CardProps } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, X } from "lucide-react";

interface ChartWrapperProps {
  title: string;
  description: string;
  children: React.ReactNode;
  fullscreenContent: React.ReactNode;
  variant?: CardProps["variant"];
}

export function ChartWrapper({ title, description, children, fullscreenContent, variant }: ChartWrapperProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const openFullscreen = () => {
    setIsFullscreen(true);
    document.body.style.overflow = "hidden";
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    document.body.style.overflow = "unset";
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        closeFullscreen();
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isFullscreen]);

  return (
    <>
      <Card className="relative" variant={variant}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={openFullscreen}
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 animate-in fade-in duration-200">
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-7xl max-h-[90vh] bg-card border rounded-lg animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-semibold">{title}</h2>
                  <p className="text-muted-foreground">{description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeFullscreen}
                  className="h-8 w-8 p-0 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 h-full overflow-auto">
                <div className="h-[calc(100vh-240px)] pb-4">
                  {fullscreenContent}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
