import { AnimatePresence, motion } from 'motion/react'
import React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import { X } from 'lucide-react'
import { Switch } from "@/components/ui/switch";

type VideoFilterKey = "original" | "warm" | "mono" | "cool" | "golden";

const VIDEO_FILTERS: Record<
  VideoFilterKey,
  { label: string; css: string; accent: string }
> = {
  original: {
    label: "Original",
    css: "none",
    accent: "bg-surface-container-highest",
  },
  warm: {
    label: "Warm",
    css: "sepia(0.25) saturate(1.35) contrast(1.04) brightness(1.02)",
    accent: "bg-orange-200",
  },
  mono: {
    label: "Mono",
    css: "grayscale(1) contrast(1.05)",
    accent: "bg-stone-300",
  },
  cool: {
    label: "Cool",
    css: "saturate(1.15) hue-rotate(20deg) contrast(1.05)",
    accent: "bg-blue-100",
  },
  golden: {
    label: "Golden",
    css: "sepia(0.18) saturate(1.55) brightness(1.08) contrast(1.03)",
    accent: "bg-rose-100",
  },
};

const FilterPanel = ({showFilters, setShowFilters, selectedFilter , setSelectedFilter}: {showFilters: boolean, setShowFilters: (value: boolean) => void, selectedFilter: string, setSelectedFilter: (value: any) => void}) => {
  return (
    <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="absolute top-6 right-6 w-85 max-h-[calc(100%-150px)] bg-white/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/40 flex flex-col z-[60]"
            >
              <div className="p-8 pb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-orange-950 tracking-tight">Studio Filters</h2>
                <button onClick={() => setShowFilters(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>
              <ScrollArea className="flex-1 px-8 pb-8">
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">Focus & Backgrounds</p>
                    <div className="grid grid-cols-2 gap-4 mx-3">
                      <FilterItem label="Original" active={selectedFilter === 'original'} icon={<XCircle size={24}/>} onClick={() => setSelectedFilter('original')} />
                      <FilterItem label="Warm" src="https://picsum.photos/seed/warm/200/120" blur active={selectedFilter === 'warm'} onClick={() => setSelectedFilter('warm')} />
                      <FilterItem label="Mono" src="https://picsum.photos/seed/mono/200/120" active={selectedFilter === 'mono'} onClick={() => setSelectedFilter('mono')}/>
                      <FilterItem label="Cool" src="https://picsum.photos/seed/cool/200/120" active={selectedFilter === 'cool'} onClick={() => setSelectedFilter('cool')}/>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4">Mood & Color</p>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide pt-3">
                      <ColorFilter
                        color={VIDEO_FILTERS.warm.accent}
                        label="Warm"
                        active={selectedFilter === "warm"}
                        onClick={() => setSelectedFilter("warm")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.mono.accent}
                        label="Mono"
                        active={selectedFilter === "mono"}
                        onClick={() => setSelectedFilter("mono")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.cool.accent}
                        label="Cool"
                        active={selectedFilter === "cool"}
                        onClick={() => setSelectedFilter("cool")}
                      />
                      <ColorFilter
                        color={VIDEO_FILTERS.golden.accent}
                        label="Golden"
                        active={selectedFilter === "golden"}
                        onClick={() => setSelectedFilter("golden")}
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="bg-surface-container-low p-6 flex items-center justify-between mt-auto border-t border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-bold text-orange-950">Auto-Touchup</span>
                </div>
                <Switch defaultChecked />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
  )
}

function FilterItem({ label, active = false, src, icon, blur = false, onClick }: {
  label: string; active?: boolean; src?: string; icon?: React.ReactNode; blur?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className="flex flex-col gap-2 text-left group" onClick={onClick}>
      <div className={`aspect-video w-full rounded-2xl overflow-hidden relative transition-all hover:shadow-xl hover:scale-105 cursor-pointer ${
        active ? "ring-[7px] ring-primary-fixed shadow-lg" : "border-transparent hover:border-outline-variant"
      } ${!src ? "bg-surface-container-highest flex items-center justify-center" : ""}`}>
        {src ? <img src={src} alt={label} className={`w-full h-full object-cover ${blur ? "blur-[2px]" : ""}`} /> : icon}
      </div>
      <span className={`text-[10px] font-bold px-1 uppercase tracking-widest ${active ? "text-primary" : "text-on-surface-variant/60"}`}>
        {label}
      </span>
    </button>
  );
}

function ColorFilter({ color, label, active = false, onClick }: any) {
  return (
    <button onClick={onClick} className="shrink-0 w-16 flex flex-col items-center gap-2 group">
      <div
        className={`w-12 h-12 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${color} ${active ? "ring-4 ring-primary/30 scale-110" : ""}`}
      />
      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}


export default FilterPanel