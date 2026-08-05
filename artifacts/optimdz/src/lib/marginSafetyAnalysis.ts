import { fmtDA, fmtN, type BreakEvenResult } from "./breakEvenAlgorithm";

export interface MarginSafetyAnalysis {
  fr: string[];
  ar: string[];
}

/**
 * Builds manager-facing explanations from the already-computed margin-of-safety
 * values. This deliberately contains no break-even or margin calculations.
 */
export function buildMarginSafetyAnalysis(result: BreakEvenResult): MarginSafetyAnalysis {
  const { input, marginOfSafetyPct: mos, marginOfSafetyUnits: mosUnits, marginOfSafetyRevenue: mosRevenue } = result;

  if (
    mos === undefined ||
    mosUnits === undefined ||
    mosRevenue === undefined ||
    input.expectedSalesVolume === undefined
  ) {
    return { fr: [], ar: [] };
  }

  const expectedUnits = input.expectedSalesVolume;
  const expectedRevenue = expectedUnits * input.sellingPrice;
  const breakEvenRevenue = result.breakEvenRevenue;
  const isAboveBreakEven = mosUnits >= 0;
  const level = mos >= 25 ? "forte" : mos >= 10 ? "modérée" : "faible";
  const levelAr = mos >= 25 ? "قوية" : mos >= 10 ? "متوسطة" : "ضعيفة";

  if (!isAboveBreakEven) {
    const missingUnits = Math.abs(mosUnits);
    const missingRevenue = Math.abs(mosRevenue);
    return {
      fr: [
        `Le volume de ventes prévu est de ${fmtN(expectedUnits, 1)} unités, soit ${fmtDA(expectedRevenue)}, contre ${fmtN(result.breakEvenUnits, 1)} unités et ${fmtDA(breakEvenRevenue)} nécessaires pour atteindre l'équilibre. Le projet est donc actuellement en dessous de son niveau de couverture des charges.`,
        `La marge de sécurité est de ${fmtN(mos, 1)} % : il n'existe aucune baisse de ventes absorbable avant la perte, puisque ${fmtN(missingUnits, 1)} unités représentant ${fmtDA(missingRevenue)} de chiffre d'affaires doivent encore être ajoutées pour atteindre le seuil.`,
        `Le niveau de sécurité est faible. Avant le lancement, le responsable doit sécuriser au minimum ces ${fmtN(missingUnits, 1)} unités supplémentaires et revoir le prix, les coûts ou le volume commercial si cet objectif n'est pas réaliste.`,
      ],
      ar: [
        `يبلغ حجم المبيعات المتوقع ${fmtN(expectedUnits, 1)} وحدة، أي ${fmtDA(expectedRevenue)}، مقابل ${fmtN(result.breakEvenUnits, 1)} وحدة و${fmtDA(breakEvenRevenue)} اللازمة لبلوغ التعادل. وهذا يعني أن المشروع يقع حالياً دون مستوى تغطية أعبائه.`,
        `تبلغ نسبة هامش الأمان ${fmtN(mos, 1)}%: لا توجد أي مبيعات يمكن فقدانها قبل تسجيل الخسارة، إذ يجب إضافة ${fmtN(missingUnits, 1)} وحدة تمثل ${fmtDA(missingRevenue)} من رقم الأعمال للوصول إلى نقطة التعادل.`,
        `مستوى الأمان ضعيف. قبل الإطلاق، يجب على المسؤول تأمين هذه الـ${fmtN(missingUnits, 1)} وحدة إضافية على الأقل، أو مراجعة السعر والتكاليف والحجم التجاري إذا كان بلوغها غير واقعي.`,
      ],
    };
  }

  return {
    fr: [
      `Le niveau de ventes prévu est de ${fmtN(expectedUnits, 1)} unités, soit ${fmtDA(expectedRevenue)}, contre ${fmtN(result.breakEvenUnits, 1)} unités et ${fmtDA(breakEvenRevenue)} au point d'équilibre. Le projet dispose ainsi d'une avance de ${fmtN(mosUnits, 1)} unités et de ${fmtDA(mosRevenue)} de chiffre d'affaires.`,
      `Une marge de sécurité de ${fmtN(mos, 1)} % signifie concrètement que les ventes peuvent reculer de ${fmtN(mos, 1)} % — jusqu'à ${fmtN(result.breakEvenUnits, 1)} unités ou ${fmtDA(breakEvenRevenue)} — avant que le projet ne commence à perdre de l'argent. Cette baisse représente ${fmtN(mosUnits, 1)} unités et ${fmtDA(mosRevenue)} de ventes absorbables.`,
      `Ce niveau constitue une sécurité ${level}. Il ${mos >= 25
        ? "offre une protection solide contre les fluctuations normales de la demande, tout en nécessitant un suivi régulier du volume."
        : "laisse une protection limitée : le plan commercial doit suivre étroitement les ventes et réagir rapidement à tout ralentissement."
      }`,
    ],
    ar: [
      `يبلغ مستوى المبيعات المتوقع ${fmtN(expectedUnits, 1)} وحدة، أي ${fmtDA(expectedRevenue)}، مقابل ${fmtN(result.breakEvenUnits, 1)} وحدة و${fmtDA(breakEvenRevenue)} عند نقطة التعادل. لذلك يملك المشروع فائضاً قدره ${fmtN(mosUnits, 1)} وحدة و${fmtDA(mosRevenue)} من رقم الأعمال.`,
      `تعني نسبة هامش أمان قدرها ${fmtN(mos, 1)}% عملياً أن المبيعات يمكن أن تنخفض بنسبة ${fmtN(mos, 1)}% — إلى ${fmtN(result.breakEvenUnits, 1)} وحدة أو ${fmtDA(breakEvenRevenue)} — قبل أن يبدأ المشروع في تسجيل الخسارة. وتمثل هذه المساحة ${fmtN(mosUnits, 1)} وحدة و${fmtDA(mosRevenue)} من المبيعات القابلة للامتصاص.`,
      `يمثل هذا المستوى هامش أمان ${levelAr}. وهو ${mos >= 25
        ? "يوفر حماية قوية من التقلبات العادية في الطلب، مع ضرورة متابعة حجم المبيعات بانتظام."
        : "يوفر حماية محدودة، لذلك يجب متابعة المبيعات عن قرب والتدخل سريعاً عند ظهور أي تباطؤ."
      }`,
    ],
  };
}