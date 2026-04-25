import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { roomService } from '@/services/roomService';
import {
  Copy,
  Check,
  Loader2,
  Video,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [loading, setLoading] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRequireApproval(false);
    setMaxParticipants(100);
    setCreatedRoomCode(null);
    setCopied(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    setLoading(true);
    try {
      const res = await roomService.createRoom({
        title: title.trim(),
        description: description.trim() || undefined,
        settings: {
          require_approval: requireApproval,
          max_participants: maxParticipants,
        },
      });

      if (res.success && res.room) {
        setCreatedRoomCode(res.room.room_code);
        toast.success('Meeting created successfully!');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (createdRoomCode) {
      await navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      toast.success('Room code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartMeeting = () => {
    if (createdRoomCode) {
      onOpenChange(false);
      resetForm();
      navigate(`/lobby?code=${createdRoomCode}`);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-surface-container-lowest rounded-3xl border-outline-variant/10 p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-primary-container p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">
              {createdRoomCode ? 'Meeting Ready!' : 'Start Instant Meeting'}
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm mt-1">
              {createdRoomCode
                ? 'Share the code below to invite participants instantly'
                : 'Start a meeting right away'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          {!createdRoomCode ? (
            <>
              {/* Title */}
              <div className="space-y-2">
                <Label
                  htmlFor="room-title"
                  className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Meeting Title
                </Label>
                <Input
                  id="room-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Design Sync"
                  className="h-12 bg-surface-container-highest border-none rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/40 focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label
                  htmlFor="room-desc"
                  className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Description
                  <span className="text-on-surface-variant/40 ml-1 normal-case tracking-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="room-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this meeting about?"
                  rows={2}
                  className="bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus-visible:ring-2 focus-visible:ring-primary resize-none"
                />
              </div>

              {/* Settings */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ShieldCheck size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        Require Approval
                      </p>
                      <p className="text-xs text-on-surface-variant/60">
                        Review join requests before admitting
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requireApproval}
                    onCheckedChange={setRequireApproval}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        Max Participants
                      </p>
                      <p className="text-xs text-on-surface-variant/60">
                        Limit the number of attendees
                      </p>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(
                        Math.max(2, Math.min(500, Number(e.target.value)))
                      )
                    }
                    className="w-20 h-10 text-center bg-surface-container-highest border-none rounded-xl font-bold"
                    min={2}
                    max={500}
                  />
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreate}
                disabled={loading || !title.trim()}
                className="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <Loader2 className="animate-spin mr-2" size={20} />
                ) : (
                  <Video className="mr-2" size={20} />
                )}
                {loading ? 'Creating...' : 'Create Instant Meeting'}
              </Button>
            </>
          ) : (
            /* Success State */
            <div className="space-y-6">
              {/* Room Code Display */}
              <div className="bg-surface-container rounded-2xl p-6 text-center space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Meeting Code
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-extrabold tracking-widest text-primary font-mono">
                    {createdRoomCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-xl hover:bg-primary/10 transition-colors text-primary"
                    aria-label="Copy room code"
                  >
                    {copied ? (
                      <Check size={20} />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant/50">
                  Share this code with participants to join
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleStartMeeting}
                  className="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Video className="mr-2" size={20} />
                  Start Meeting Now
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  className="w-full h-12 rounded-full font-bold text-on-surface-variant hover:text-primary"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
