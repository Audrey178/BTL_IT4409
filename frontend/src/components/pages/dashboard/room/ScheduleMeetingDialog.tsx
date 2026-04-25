import { useState } from 'react';
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
  CalendarDays,
  ShieldCheck,
  Users,
  Clock,
} from 'lucide-react';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

export function ScheduleMeetingDialog({ open, onOpenChange, onScheduled }: ScheduleMeetingDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [loading, setLoading] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setRequireApproval(true);
    setMaxParticipants(100);
    setCreatedRoomCode(null);
    setCopied(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }
    if (!date || !time) {
      toast.error('Please select both date and time');
      return;
    }

    const scheduledDate = new Date(`${date}T${time}`);
    const now = new Date();

    // Must be in the future (at least 2 minutes)
    if (scheduledDate.getTime() < now.getTime() + 2 * 60000) {
      toast.error('Scheduled time must be at least 2 minutes in the future');
      return;
    }

    setLoading(true);
    try {
      const res = await roomService.createRoom({
        title: title.trim(),
        description: description.trim() || undefined,
        started_at: scheduledDate.toISOString(),
        settings: {
          require_approval: requireApproval,
          max_participants: maxParticipants,
        },
      });

      if (res.success && res.room) {
        setCreatedRoomCode(res.room.room_code);
        toast.success('Meeting scheduled successfully!');
        if (onScheduled) onScheduled();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to schedule meeting');
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

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-surface-container-lowest rounded-3xl border-outline-variant/10 p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">
              {createdRoomCode ? 'Meeting Scheduled!' : 'Schedule Meeting'}
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm mt-1">
              {createdRoomCode
                ? 'Your meeting has been added to the calendar'
                : 'Plan an upcoming meeting session'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          {!createdRoomCode ? (
            <>
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="sched-title" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Meeting Title
                </Label>
                <Input
                  id="sched-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Strategy Review"
                  className="h-12 bg-surface-container-highest border-none rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/40 focus-visible:ring-2 focus-visible:ring-blue-600"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sched-date" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-blue-600" />
                    Date
                  </Label>
                  <Input
                    id="sched-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="h-12 bg-surface-container-highest border-none rounded-xl px-4 text-on-surface focus-visible:ring-2 focus-visible:ring-blue-600 appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sched-time" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-600" />
                    Time
                  </Label>
                  <Input
                    id="sched-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-12 bg-surface-container-highest border-none rounded-xl px-4 text-on-surface focus-visible:ring-2 focus-visible:ring-blue-600 appearance-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="sched-desc" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Description <span className="text-on-surface-variant/40 normal-case tracking-normal">(optional)</span>
                </Label>
                <Textarea
                  id="sched-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agenda or context for the meeting..."
                  rows={2}
                  className="bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus-visible:ring-2 focus-visible:ring-blue-600 resize-none"
                />
              </div>

              {/* Settings */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <ShieldCheck size={18} className="text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Require Approval</p>
                      <p className="text-xs text-on-surface-variant/60">Review join requests</p>
                    </div>
                  </div>
                  <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Users size={18} className="text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Max Participants</p>
                      <p className="text-xs text-on-surface-variant/60">Limit attendees</p>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Math.max(2, Math.min(500, Number(e.target.value))))}
                    className="w-20 h-10 text-center bg-surface-container-highest border-none rounded-xl font-bold focus-visible:ring-2 focus-visible:ring-blue-600"
                    min={2}
                    max={500}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={loading || !title.trim() || !date || !time}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-full font-bold text-lg shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <CalendarDays className="mr-2" size={20} />}
                {loading ? 'Scheduling...' : 'Schedule Meeting'}
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-surface-container rounded-2xl p-6 text-center space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Meeting Code
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-extrabold tracking-widest text-blue-700 font-mono">
                    {createdRoomCode}
                  </span>
                  <button onClick={handleCopy} className="p-2 rounded-xl hover:bg-blue-100 transition-colors text-blue-700">
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
                <div className="text-sm font-medium text-on-surface-variant/70 bg-surface-container-highest mt-4 mx-auto w-fit px-4 py-2 rounded-full flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  {date} at {time}
                </div>
              </div>

              <Button onClick={() => handleClose(false)} className="w-full h-14 bg-surface-container text-on-surface rounded-full font-bold text-lg hover:bg-surface-container-high transition-all">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
