import { PublicLayout } from "@/components/layout/PublicLayout";
import { ShieldCheck, CheckCircle2, AlertCircle, Phone, Clock, Lock, Handshake } from "lucide-react";

const guaranteePoints = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-green-500" />,
    title: "ضمان صحة الحساب",
    desc: "كل حساب يُفحص ويُتحقق منه قبل عرضه في المتجر. نضمن أن المعلومات المعروضة (المتابعين، الحالة، الميزات) مطابقة للواقع.",
    color: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
  },
  {
    icon: <Lock className="w-6 h-6 text-blue-500" />,
    title: "تسليم آمن عبر واتساب",
    desc: "يتم تسليم بيانات الحساب مباشرةً عبر واتساب بعد التأكد من إتمام الدفع. لا تُشارك بياناتك مع أي طرف ثالث.",
    color: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: <Clock className="w-6 h-6 text-purple-500" />,
    title: "تسليم فوري",
    desc: "فور إتمام عملية الدفع يُرسل الحساب خلال دقائق. فريق الدعم متاح طوال اليوم لضمان تجربة سريعة وسلسة.",
    color: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30",
  },
  {
    icon: <Handshake className="w-6 h-6 text-orange-500" />,
    title: "ضمان ما بعد البيع",
    desc: "في حال وجود أي مشكلة بعد استلام الحساب خلال 24 ساعة من الاستلام، نلتزم بحل المشكلة أو استبدال الحساب.",
    color: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30",
  },
];

const steps = [
  { num: "١", label: "تصفح الحسابات واختر الحساب المناسب" },
  { num: "٢", label: "اضغط على زر 'اشتري الآن' للتواصل عبر واتساب" },
  { num: "٣", label: "أرسل طريقة الدفع (تحويل / نقد)" },
  { num: "٤", label: "استلم بيانات الحساب فوراً بعد التأكيد" },
];

export default function Guarantee() {
  return (
    <PublicLayout>
      {/* Hero */}
      <div className="bg-primary/5 border-b py-10 sm:py-14">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black mb-3">🛡️ ضمان المعاملة</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            نلتزم بتقديم تجربة شراء آمنة وموثوقة. اطّلع على سياسة الضمان الكاملة الخاصة بمتجر فلسطين.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-2xl space-y-6">

        {/* Guarantee cards */}
        {guaranteePoints.map((point, i) => (
          <div key={i} className={`rounded-2xl border p-5 sm:p-6 ${point.color}`}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-0.5">{point.icon}</div>
              <div>
                <h2 className="font-black text-base sm:text-lg mb-1">{point.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{point.desc}</p>
              </div>
            </div>
          </div>
        ))}

        {/* How it works */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-sm">
          <h2 className="font-black text-base sm:text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            كيف تتم عملية الشراء؟
          </h2>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.num} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shrink-0">
                  {step.num}
                </span>
                <span className="text-sm font-medium">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-yellow-800 dark:text-yellow-400 mb-1">تنبيه مهم</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-500 leading-relaxed">
                تأكد دائماً من التواصل عبر القنوات الرسمية للمتجر (واتساب أو تيليجرام). لا نطلب بيانات شخصية خارج عملية التسليم.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-4">
          <p className="text-sm text-muted-foreground mb-3">هل لديك سؤال حول الضمان؟</p>
          <a
            href="https://wa.me/972566112031"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-full transition-colors text-sm"
          >
            <Phone className="w-4 h-4" />
            تواصل معنا عبر واتساب
          </a>
        </div>

      </div>
    </PublicLayout>
  );
}
