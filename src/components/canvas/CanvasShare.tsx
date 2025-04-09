
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Share, Copy, CheckCircle, Loader2, Link, QrCode } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';

const CanvasShare: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copyLinkClicked, setCopyLinkClicked] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { peerId, isPeerInitialized, generateShareLink, generateQRCode, initializePeer } = useWebSocket();
  
  const handleOpenShareDialog = async () => {
    // Only initialize peer when opening the share dialog
    setIsDialogOpen(true);
    
    if (!isPeerInitialized) {
      setIsInitializing(true);
      try {
        await initializePeer();
      } catch (error) {
        console.error('Failed to initialize peer:', error);
        toast.error('Failed to initialize peer connection. Please try again later.');
      } finally {
        setIsInitializing(false);
      }
    }
  };
  
  const copyPeerId = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      setCopied(true);
      toast.success('Peer ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyShareLink = () => {
    const shareLink = generateShareLink();
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopyLinkClicked(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopyLinkClicked(false), 2000);
    }
  };
  
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 bg-green-500 text-white hover:bg-green-600"
          onClick={handleOpenShareDialog}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <Share size={16} />
              Share
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Canvas</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="code" className="mt-4">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="code">Peer ID</TabsTrigger>
            <TabsTrigger value="link">Share Link</TabsTrigger>
            <TabsTrigger value="qrcode">QR Code</TabsTrigger>
          </TabsList>
          
          <TabsContent value="code">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Your Peer ID (Share this with others to let them join)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={isPeerInitialized ? (peerId || 'Error getting ID') : 'Initializing...'}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPeerId}
                  disabled={!peerId}
                >
                  {copied ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Share this Peer ID with others to collaborate on this canvas in real-time.
                They'll need to enter this ID in the "Join Canvas" page.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="link">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Share this link with others to let them join
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={isPeerInitialized ? generateShareLink() : 'Initializing...'}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyShareLink}
                  disabled={!peerId}
                >
                  {copyLinkClicked ? <CheckCircle size={18} className="text-green-500" /> : <Link size={18} />}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Users who open this link will be able to join your canvas directly.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="qrcode">
            <div className="flex flex-col items-center gap-4">
              <label className="text-sm font-medium">
                Scan this QR code to join the canvas
              </label>
              {isPeerInitialized && peerId ? (
                <div className="bg-white p-2 rounded-lg">
                  <img 
                    src={generateQRCode()} 
                    alt="QR Code for joining canvas" 
                    className="w-48 h-48"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-48 h-48 bg-gray-100 rounded-lg">
                  <Loader2 size={32} className="animate-spin text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Initializing...</p>
                </div>
              )}
              <p className="mt-2 text-sm text-muted-foreground text-center">
                Perfect for sharing with nearby devices. Just scan the code with your phone camera.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        {isInitializing && (
          <p className="mt-2 text-orange-500">
            Initializing peer connection. Please wait a moment...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CanvasShare;
