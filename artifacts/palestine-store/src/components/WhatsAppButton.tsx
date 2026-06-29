import { useGetSettings, useTrackWhatsappClick } from "@workspace/api-client-react";
import { useState } from "react";

const WhatsAppSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.054 23.25a.75.75 0 0 0 .916.997l5.542-1.451A11.935 11.935 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.717 9.717 0 0 1-5.003-1.386l-.36-.214-3.717.974.993-3.62-.235-.374A9.713 9.713 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
  </svg>
);

export function WhatsAppButton() {
  const { data: settings } = useGetSettings();
  const trackClick = useTrackWhatsappClick();
  const [pressed, setPressed] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 300);
    trackClick.mutate();
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  return (
    <>
      <style>{`
        @keyframes wa-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(37,211,102,0.55); }
          60%  { box-shadow: 0 0 0 14px rgba(37,211,102,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
        }
        .wa-btn { animation: wa-pulse 3.5s ease-out infinite; }
        .wa-btn:hover { animation: none; }

        .wa-wrap {
          position: fixed;
          z-index: 50;
          right: 24px;
          bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
      `}</style>

      <div
        className="wa-wrap"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Tooltip — يظهر على يسار الزر */}
        <div
          className={`
            bg-gray-900/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg
            whitespace-nowrap shadow-lg backdrop-blur-sm relative
            transition-all duration-200 origin-right
            ${showTooltip ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-2 scale-95 pointer-events-none"}
          `}
          style={{ direction: "rtl" }}
        >
          تواصل معنا عبر واتساب
          {/* Arrow pointing right toward button */}
          <span className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-gray-900/90" />
        </div>

        {/* Button */}
        <button
          onClick={handleClick}
          aria-label="تواصل معنا عبر واتساب"
          className="wa-btn relative flex items-center justify-center rounded-full text-white select-none"
          style={{
            width: 58,
            height: 58,
            background: "linear-gradient(135deg, #2ddc6e 0%, #25D366 50%, #1db954 100%)",
            boxShadow: "0 4px 20px rgba(37,211,102,0.45), 0 2px 8px rgba(0,0,0,0.18)",
            transform: pressed ? "scale(0.88)" : showTooltip ? "scale(1.1)" : "scale(1)",
            transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease",
          }}
        >
          {/* Gloss overlay */}
          <span
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
            }}
          />
          <span className="relative w-7 h-7">
            <WhatsAppSVG />
          </span>
        </button>
      </div>
    </>
  );
}
