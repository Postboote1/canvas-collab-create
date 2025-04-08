import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Share, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';

const CanvasShare: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const { peerId, isPeerInitialized } = useWebSocket();
  
  const copyPeerId = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      setCopied(true);
      toast.success('Peer ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 bg-green-500 text-white hover:bg-green-600"
          disabled={!isPeerInitialized}
        >
          {isPeerInitialized ? (
            <>
              <Share size={16} />
              Share
            </>
          ) : (
            <>
              <Loader2 size={16} className="animate-spin" />
              Initializing...
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Canvas</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
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
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>
              Share this Peer ID with others to collaborate on this canvas in real-time.
              They'll need to enter this ID in the "Join Canvas" page.
            </p>
            {!isPeerInitialized && (
              <p className="mt-2 text-orange-500">
                Still initializing peer connection. Please wait a moment...
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CanvasShare;