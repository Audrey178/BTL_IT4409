import React, { useState, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { motion } from "motion/react";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SideBar from "@/components/layout/SideBar";
import { ScheduleMeetingDialog } from "@/components/pages/dashboard/room/ScheduleMeetingDialog";
import { MeetingDetailDialog } from "@/components/pages/schedule/MeetingDetailDialog";
import { CalendarEventContent } from "@/components/pages/schedule/CalendarEventContent";
import { useUpcomingMeetings } from "@/hooks/useUpcomingMeetings";
import type { ScheduledMeeting } from "@/types";

export function ScheduleScreen() {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ScheduledMeeting | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { meetings, loading, refetch } = useUpcomingMeetings();

  // Filter: only meetings with started_at and not ended (REQ-03, REQ-12)
  const calendarMeetings = useMemo(
    () => meetings.filter((m) => m.started_at && m.status !== "ended"),
    [meetings]
  );

  // Map to FullCalendar event format
  const events = useMemo(
    () =>
      calendarMeetings.map((m) => ({
        id: m._id,
        title: m.title,
        start: m.started_at!,
        extendedProps: { meeting: m },
      })),
    [calendarMeetings]
  );

  const handleEventClick = (info: EventClickArg) => {
    const meeting: ScheduledMeeting = info.event.extendedProps.meeting;
    setSelectedMeeting(meeting);
    setDetailOpen(true);
  };

  const renderEventContent = (eventInfo: EventContentArg) => (
    <CalendarEventContent eventInfo={eventInfo} />
  );

  return (
    <div className="flex min-h-screen">
      <SideBar onNewMeeting={() => setShowScheduleDialog(true)} />

      <main className="ml-64 flex-1 p-8 lg:p-12 bg-surface">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <span className="text-primary font-semibold tracking-widest uppercase text-xs">
              Calendar
            </span>
            <h1 className="text-5xl font-extrabold tracking-tighter text-on-surface">
              Schedule
            </h1>
            <p className="text-on-surface-variant max-w-md text-lg">
              Your upcoming meetings at a glance.
            </p>
          </div>
          <Button
            onClick={() => setShowScheduleDialog(true)}
            className="h-14 px-8 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
          >
            <Plus className="group-hover:rotate-90 transition-transform" size={20} />
            Schedule Meeting
          </Button>
        </header>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6 fc-custom"
        >
          {loading ? (
            <div className="flex items-center justify-center h-96 text-on-surface-variant">
              Loading schedule…
            </div>
          ) : events.length === 0 ? (
            <EmptyState onSchedule={() => setShowScheduleDialog(true)} />
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={events}
              eventContent={renderEventContent}
              eventClick={handleEventClick}
              height="auto"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              dayMaxEvents={3}
            />
          )}
        </motion.div>
      </main>

      {/* Dialogs */}
      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onScheduled={refetch}
      />
      <MeetingDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        meeting={selectedMeeting}
      />
    </div>
  );
}

function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
        <Calendar size={32} className="text-on-surface-variant/40" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-on-surface">No meetings this month</p>
        <p className="text-sm text-on-surface-variant/60">
          Schedule a session to see it appear here.
        </p>
      </div>
      <Button
        onClick={onSchedule}
        className="mt-2 h-11 px-6 bg-primary text-white rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all"
      >
        <Plus size={18} className="mr-2" />
        Schedule Meeting
      </Button>
    </div>
  );
}
