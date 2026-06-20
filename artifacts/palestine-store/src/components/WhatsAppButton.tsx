import { useGetSettings, useTrackWhatsappClick } from "@workspace/api-client-react";
import { MessageCircle } from "lucide-react";

export function WhatsAppButton() {
  const { data: settings } = useGetSettings();
  const trackClick = useTrackWhatsappClick();

  const handleClick = () => {
    trackClick.mutate();
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
      aria-label="تواصل معنا عبر واتساب"
    >
      <MessageCircle size={30} />
    </button>
  );
}
