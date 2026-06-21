import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListReviews } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

export default function Feedback() {
  const { data: reviews, isLoading } = useListReviews();

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">آراء وتجارب عملائنا</h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
            نفخر بثقة عملائنا ونسعى دائماً لتقديم أفضل خدمة وأفضل الحسابات. يمكنكم الاطلاع على تجارب العملاء وآرائهم الحقيقية معنا.
          </p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && (!reviews || reviews.length === 0) && (
          <div className="text-center py-20 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا يوجد تقييمات حتى الآن.</p>
          </div>
        )}

        {!isLoading && reviews && reviews.length > 0 && (
          <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="break-inside-avoid rounded-2xl border overflow-hidden shadow-sm bg-card">
                <img
                  src={review.imageUrl}
                  alt={review.caption || "تقييم عميل"}
                  className="w-full object-cover"
                  loading="lazy"
                />
                {review.caption && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">{review.caption}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
