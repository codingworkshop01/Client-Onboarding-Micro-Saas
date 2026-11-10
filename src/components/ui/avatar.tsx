import { cn, initials } from "@/lib/utils";

const tones = ["bg-[#e0e7ff] text-[#3730a3]", "bg-[#dcfce7] text-[#166534]", "bg-[#fef3c7] text-[#92400e]", "bg-[#fce7f3] text-[#9d174d]", "bg-[#e0f2fe] text-[#075985]", "bg-[#ede9fe] text-[#5b21b6]"];

function Avatar({ name, className, src }: { name?: string | null; className?: string; src?: string | null }) {
  const tone = tones[(name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("size-8 rounded-full object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", tone, className)}>
      {initials(name)}
    </span>
  );
}

export { Avatar };
