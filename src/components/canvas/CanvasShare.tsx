
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCanvas } from '@/contexts/CanvasContext';
import { toast } from 'sonner';
import { QrCode, Copy, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CanvasShareProps {
  className?: string;
}

const CanvasShare: React.FC<CanvasShareProps> = ({ className }) => {
  const { currentCanvas, generateQRCode } = useCanvas();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  if (!currentCanvas) return null;
  
  const shareUrl = `${window.location.origin}/join/${currentCanvas.joinCode}`;
  const qrCodeUrl = generateQRCode(currentCanvas.joinCode);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Copied to clipboard!'))
      .catch(() => toast.error('Failed to copy to clipboard'));
  };
  
  const shareCanvas = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join Canvas: ${currentCanvas.name}`,
        text: `Join my canvas "${currentCanvas.name}" on CanvasCollab!`,
        url: shareUrl,
      })
        .then(() => toast.success('Shared successfully!'))
        .catch((error) => {
          console.error('Error sharing:', error);
          toast.error('Failed to share');
        });
    } else {
      copyToClipboard(shareUrl);
    }
  };
  
  return (
    <div className={className}>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="flex items-center gap-2">
            <Share2 size={16} />
            Share Canvas
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Canvas</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center justify-center gap-4">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-44 h-44 border rounded-md"
              />
              <p className="text-sm text-gray-500">Scan to join canvas</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium" htmlFor="join-code">
                    Join Code:
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold">{currentCanvas.joinCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => copyToClipboard(currentCanvas.joinCode)}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    id="share-link"
                    value={shareUrl}
                    readOnly
                    className="h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-3"
                    onClick={() => copyToClipboard(shareUrl)}
                  >
                    <span className="sr-only">Copy</span>
                    <Copy size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={shareCanvas}>
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CanvasShare;
