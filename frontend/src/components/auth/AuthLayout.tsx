import React from "react";
import { motion } from "motion/react";
import { Flame } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left Side: Form */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-[45%] flex flex-col justify-center px-8 md:px-20 py-12 bg-surface"
      >
        <div className="max-w-md w-full mx-auto">
          <div className="mb-12 flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
              <Flame className="text-white fill-current" size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-primary">
              The Digital Hearth
            </span>
          </div>

          <div className="space-y-2 mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface leading-tight">
              {title}
            </h1>
            <p className="text-on-surface-variant text-lg font-medium leading-relaxed">
              {description}
            </p>
          </div>

          {children}
        </div>
      </motion.section>

      {/* Right Side: Visual */}
      <section className="hidden lg:flex flex-1 relative bg-surface-container-low overflow-hidden items-center justify-center p-12">
        <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-primary-fixed/30 rounded-bl-[200px] -z-0" />
        <div className="relative z-10 w-full max-w-2xl">
          <div className="grid grid-cols-12 gap-6 items-end">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-7 bg-surface-container-lowest rounded-[2rem] p-4 shadow-2xl shadow-outline/10 group hover:scale-[1.02] transition-transform duration-500"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden relative">
                <img
                  src="https://picsum.photos/seed/hearth1/800/1000"
                  alt="Professional woman"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-4 left-4 bg-surface-container-lowest/80 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-on-surface">
                    Sarah Mitchell
                  </span>
                </div>
              </div>
            </motion.div>

            <div className="col-span-5 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-surface-container-lowest rounded-[2rem] p-3 shadow-xl shadow-outline/5 hover:scale-[1.02] transition-transform duration-500"
              >
                <div className="aspect-square rounded-2xl overflow-hidden relative">
                  <img
                    src="https://picsum.photos/seed/hearth2/600/600"
                    alt="Man in library"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-3 left-3 bg-surface-container-lowest/80 backdrop-blur-md px-3 py-1.5 rounded-full">
                    <span className="text-[10px] font-bold text-on-surface">
                      David Chen
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: -3 }}
                transition={{ delay: 0.6 }}
                whileHover={{ rotate: 0 }}
                className="bg-gradient-to-br from-primary-container to-primary rounded-[2rem] p-6 text-white shadow-2xl shadow-primary/30 transition-all duration-500"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                    <Flame size={20} className="fill-current" />
                  </div>
                  <span className="font-bold tracking-tight">
                    Studio Quality
                  </span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-white/90">
                  Crystal clear audio and cinematic video quality for every
                  conversation.
                </p>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-lg max-w-lg mx-auto"
          >
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Flame
                  key={i}
                  size={16}
                  className="text-primary fill-current"
                />
              ))}
            </div>
            <p className="text-on-surface font-headline font-bold text-xl leading-snug italic">
              "The Digital Hearth changed how our remote team connects. It feels
              less like a tool and more like a space."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-[10px] font-bold text-on-primary-fixed">
                AM
              </div>
              <span className="text-sm font-bold text-on-surface-variant">
                Alex Morgan, Creative Director
              </span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
