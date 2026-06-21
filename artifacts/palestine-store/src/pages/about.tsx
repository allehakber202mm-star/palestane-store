import { PublicLayout } from "@/components/layout/PublicLayout";
import { ShieldCheck, Users, CheckCircle2, Video, Zap, HeadphonesIcon } from "lucide-react";

const features = [
  {
    icon: <ShieldCheck className="w-7 h-7 text-green-500" />,
    title: "ضمان أمان 100%",
    desc: "جميع الحسابات مفحوصة ومضمونة وموثقة بالكامل قبل عرضها للبيع.",
    color: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: <Users className="w-7 h-7 text-blue-500" />,
    title: "متابعين حقيقيين",
    desc: "متابعون حقيقيون وفعليون بدون أي بوتات أو حسابات وهمية.",
    color: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: <CheckCircle2 className="w-7 h-7 text-emerald-500" />,
    title: "نظيف بدون انتهاكات",
    desc: "حسابات نظيفة بالكامل خالية من أي انتهاكات أو تحذيرات.",
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: <Video className="w-7 h-7 text-purple-500" />,
    title: "شغال لايف",
    desc: "جميع الحسابات مفعّلة لميزة البث المباشر.",
    color: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: <Zap className="w-7 h-7 text-yellow-500" />,
    title: "تسليم فوري",
    desc: "استلم حسابك فور إتمام عملية الدفع مباشرةً عبر واتساب.",
    color: "bg-yellow-500/10 border-yellow-500/20",
  },
  {
    icon: <HeadphonesIcon className="w-7 h-7 text-primary" />,
    title: "دعم متواصل",
    desc: "فريق الدعم جاهز لمساعدتك على مدار الساعة.",
    color: "bg-primary/10 border-primary/20",
  },
];

export default function About() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black">لماذا متجر فلسطين؟</h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            نحن منصة متخصصة في بيع حسابات التواصل الاجتماعي الموثوقة، ونسعى لتوفير حسابات عالية الجودة بأسعار مناسبة مع دعم سريع وخدمة موثوقة. هدفنا توفير تجربة شراء آمنة وسهلة لجميع العملاء.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className={`flex items-start gap-4 p-5 rounded-2xl border shadow-sm ${f.color}`}>
              <div className="shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <h3 className="font-bold text-base mb-1">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
