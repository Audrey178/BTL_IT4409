import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, ShieldCheck, Video, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduledMeeting } from "@/types";

interface MeetingCardProps {
  meeting: ScheduledMeeting;
  onJoin: (code: string) => void;
}

const MeetingCard = ({ meeting, onJoin }: MeetingCardProps) => {
  const [timeDiffMinutes, setTimeDiffMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!meeting.started_at || meeting.status === 'ended') return;

    const calcDiff = () => {
      const now = new Date().getTime();
      const scheduledTime = new Date(meeting.started_at!).getTime();
      setTimeDiffMinutes((scheduledTime - now) / 60000);
    };

    calcDiff();
    const interval = setInterval(calcDiff, 60000);
    return () => clearInterval(interval);
  }, [meeting.started_at, meeting.status]);

  let dateDisplay = "TBD";
  let monthDisplay = "";
  let timeDisplay = "Instant";
  let isActive = meeting.status === 'active' || meeting.status === 'waiting';

  if (meeting.started_at) {
    const started = new Date(meeting.started_at);
    dateDisplay = started.getDate().toString().padStart(2, '0');
    monthDisplay = started.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    timeDisplay = started.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (timeDiffMinutes !== null) {
      if (timeDiffMinutes > 15) {
        isActive = false; // Too early to be active
      }
    }
  }

  const isTooEarly = timeDiffMinutes !== null && timeDiffMinutes > 15;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-transparent flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
        isActive ? 'hover:border-primary/50' : 'hover:border-outline-variant/20'
      }`}
    >
      <div className="flex items-start gap-6">
        <div
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
            isActive
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {monthDisplay ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {monthDisplay}
              </span>
              <span className="text-2xl font-extrabold">{dateDisplay}</span>
            </>
          ) : (
            <Video size={24} />
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
            {meeting.title}
            {meeting.settings?.require_approval && (
              <ShieldCheck size={16} className="text-blue-500" />
            )}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
            <span className={`flex items-center gap-1.5 ${isActive ? 'text-primary' : 'text-on-surface-variant/70'}`}>
              <Clock size={16} /> 
              {timeDisplay}
              {timeDiffMinutes !== null && timeDiffMinutes > 0 && timeDiffMinutes <= 60 && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md font-bold">
                  Starts in {Math.ceil(timeDiffMinutes)}m
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs font-bold text-on-surface-variant/50 uppercase tracking-wider">
            Room Code: <span className="font-mono text-on-surface-variant tracking-normal bg-surface-container px-2 py-1 rounded-md">{meeting.room_code}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Only show join button if it's not too early or if it's an instant meeting */}
        <Button
          onClick={() => onJoin(meeting.room_code)}
          disabled={isTooEarly}
          className={`px-10 h-12 rounded-full font-bold transition-all active:scale-95 ${
            isTooEarly ? "opacity-50" : ""
          } ${
            isActive
              ? "bg-primary text-white hover:shadow-lg shadow-primary/20"
              : "variant-outline border bg-surface-container text-on-surface border-outline-variant/20 hover:bg-surface-container-high"
          }`}
        >
          {isTooEarly ? 'Starts Soon' : 'Join'}
        </Button>
      </div>
    </motion.div>
  );
};

export default MeetingCard;
