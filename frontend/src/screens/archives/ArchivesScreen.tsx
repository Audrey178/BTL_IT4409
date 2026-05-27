import { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Archive,
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SideBar from "@/components/layout/SideBar";
import { RecordingCard } from "@/components/pages/archives/RecordingCard";
import { DeleteRecordingDialog } from "@/components/pages/archives/DeleteRecordingDialog";
import { useRecordings } from "@/hooks/useRecordings";
import type { Recording } from "@/services/recordingService";

export function ArchivesScreen() {
  const { recordings, loading, error, pagination, fetchRecordings, removeRecording } =
    useRecordings();

  const [searchCode, setSearchCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Recording | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSearch = useCallback(() => {
    fetchRecordings({
      roomCode: searchCode.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: 1,
    });
  }, [searchCode, dateFrom, dateTo, fetchRecordings]);

  const handleClearFilters = useCallback(() => {
    setSearchCode("");
    setDateFrom("");
    setDateTo("");
    fetchRecordings({ page: 1 });
  }, [fetchRecordings]);

  const handlePageChange = useCallback(
    (page: number) => {
      fetchRecordings({
        roomCode: searchCode.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      });
    },
    [searchCode, dateFrom, dateTo, fetchRecordings]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeRecording(deleteTarget._id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, removeRecording]);

  const hasActiveFilters = searchCode.trim() || dateFrom || dateTo;

  return (
    <div className="flex min-h-screen">
      <SideBar />

      <main className="ml-64 flex-1 p-8 lg:p-12 bg-surface">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <span className="text-primary font-semibold tracking-widest uppercase text-xs">
              Library
            </span>
            <h1 className="text-5xl font-extrabold tracking-tighter text-on-surface">
              Archives
            </h1>
            <p className="text-on-surface-variant max-w-md text-lg">
              Browse and manage your meeting recordings.
            </p>
          </div>
          {pagination.total > 0 && (
            <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2">
              <Video size={16} className="text-on-surface-variant" />
              <span className="text-sm font-bold text-on-surface">
                {pagination.total} recording{pagination.total !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </header>

        {/* Filters Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 mb-8 shadow-sm"
        >
          <div className="flex flex-wrap items-end gap-4">
            {/* Room code search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1.5 block">
                Search by Room Code
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40"
                />
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. ABC123"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 border border-outline-variant/10 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {/* Date from */}
            <div className="min-w-[160px]">
              <label className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1.5 block">
                From
              </label>
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none"
                />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container rounded-xl text-sm font-medium text-on-surface border border-outline-variant/10 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {/* Date to */}
            <div className="min-w-[160px]">
              <label className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1.5 block">
                To
              </label>
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container rounded-xl text-sm font-medium text-on-surface border border-outline-variant/10 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSearch}
                className="h-11 px-6 bg-primary text-white rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Search size={16} className="mr-2" />
                Search
              </Button>
              {hasActiveFilters && (
                <Button
                  onClick={handleClearFilters}
                  variant="outline"
                  className="h-11 px-4 rounded-full font-bold border-outline-variant/20"
                >
                  <X size={16} className="mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchRecordings({ page: 1 })} />
        ) : recordings.length === 0 ? (
          <EmptyState hasFilters={!!hasActiveFilters} onClear={handleClearFilters} />
        ) : (
          <>
            {/* Recording Grid */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {recordings.map((recording) => (
                <RecordingCard
                  key={recording._id}
                  recording={recording}
                  onDelete={setDeleteTarget}
                />
              ))}
            </motion.div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="rounded-full px-4"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .filter((p) => {
                      // Show first, last, current ± 1
                      return (
                        p === 1 ||
                        p === pagination.pages ||
                        Math.abs(p - pagination.page) <= 1
                      );
                    })
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-1">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-on-surface-variant/40 text-xs px-1">…</span>
                        )}
                        <button
                          onClick={() => handlePageChange(p)}
                          className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                            p === pagination.page
                              ? "bg-primary text-white"
                              : "text-on-surface-variant hover:bg-surface-container"
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="rounded-full px-4"
                >
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Dialog */}
      <DeleteRecordingDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        recording={deleteTarget}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}

/* ---- Sub-components ---- */

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden"
          aria-busy="true"
        >
          <div className="aspect-video bg-surface-container-high animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-surface-container-high rounded-lg animate-pulse w-3/4" />
            <div className="h-3 bg-surface-container-high rounded-lg animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-20 h-20 rounded-3xl bg-surface-container flex items-center justify-center">
        <Archive size={40} className="text-on-surface-variant/30" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-on-surface text-lg">
          {hasFilters ? "No recordings found" : "No recordings yet"}
        </p>
        <p className="text-sm text-on-surface-variant/60 max-w-sm">
          {hasFilters
            ? "Try adjusting your search or filters."
            : "Recordings from your meetings will appear here."}
        </p>
      </div>
      {hasFilters && (
        <Button
          onClick={onClear}
          variant="outline"
          className="mt-2 rounded-full px-6 font-bold"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center">
        <Video size={40} className="text-error/40" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-on-surface text-lg">Something went wrong</p>
        <p className="text-sm text-on-surface-variant/60 max-w-sm">{message}</p>
      </div>
      <Button
        onClick={onRetry}
        className="mt-2 rounded-full px-6 font-bold bg-primary text-white"
      >
        Try again
      </Button>
    </div>
  );
}
