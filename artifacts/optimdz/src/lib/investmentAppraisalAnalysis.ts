import {
  fmtDA,
  fmtN,
  fmtPct,
  fmtYears,
  type InvestmentAppraisalResult,
} from "./investmentAppraisalAlgorithm";

export interface InvestmentAppraisalAnalysis {
  fr: string[];
  ar: string[];
}

/**
 * Builds short, manager-facing paragraphs from the computed appraisal result.
 * This function only explains the result; it does not perform calculations.
 */
export function buildInvestmentAppraisalAnalysis(
  result: InvestmentAppraisalResult,
): InvestmentAppraisalAnalysis {
  const {
    input,
    npv,
    irr,
    simplePayback,
    discountedPayback,
  } = result;
  const requiredRate = input.discountRate;
  const projectDuration = input.duration;

  const npvParagraphs = npv > 0
    ? {
        fr: `La valeur actuelle nette du projet est positive, à ${fmtDA(npv)}, après prise en compte du taux d'actualisation de ${fmtPct(requiredRate, 1)}. Cela signifie que les flux de trésorerie attendus couvrent l'investissement initial et le rendement exigé, tout en créant encore ${fmtDA(npv)} de valeur : le projet est acceptable financièrement, sous réserve que les hypothèses commerciales soient réalistes.`,
        ar: `صافي القيمة الحالية للمشروع موجب ويبلغ ${fmtDA(npv)} بعد احتساب معدل الخصم البالغ ${fmtPct(requiredRate, 1)}. وهذا يعني أن التدفقات النقدية المتوقعة تغطي الاستثمار الأولي والعائد المطلوب، مع إنشاء قيمة إضافية قدرها ${fmtDA(npv)}؛ لذلك يُعد المشروع مقبولاً مالياً، بشرط واقعية الفرضيات التجارية.`,
      }
    : {
        fr: `La valeur actuelle nette du projet est ${npv === 0 ? "nulle" : "négative"}, à ${fmtDA(npv)}, au taux d'actualisation de ${fmtPct(requiredRate, 1)}. Les flux attendus ne créent donc pas de valeur au-delà du rendement exigé${npv < 0 ? ` et détruisent ${fmtDA(Math.abs(npv))} de valeur actuelle` : ""} : le projet ne devrait pas être accepté dans sa configuration actuelle.`,
        ar: `صافي القيمة الحالية للمشروع ${npv === 0 ? "يساوي صفراً" : "سالب"} ويبلغ ${fmtDA(npv)} عند معدل الخصم ${fmtPct(requiredRate, 1)}. لذلك لا تُنشئ التدفقات المتوقعة قيمة تتجاوز العائد المطلوب${npv < 0 ? `، بل تُدمّر ${fmtDA(Math.abs(npv))} من القيمة الحالية` : ""}؛ ومن ثم لا ينبغي قبول المشروع بصيغته الحالية.`,
      };

  const irrParagraph = irr === null
    ? {
        fr: `Le taux de rendement interne n'a pas pu être déterminé à partir des flux saisis. Sans comparaison fiable avec le rendement requis de ${fmtPct(requiredRate, 1)}, la décision doit rester prudente et les flux, leur calendrier et leur signe doivent être revus avant tout engagement.`,
        ar: `تعذّر تحديد معدل العائد الداخلي انطلاقاً من التدفقات المُدخلة. وبغياب مقارنة موثوقة مع العائد المطلوب البالغ ${fmtPct(requiredRate, 1)}، يجب أن يبقى القرار حذراً مع مراجعة التدفقات وتوقيتها واتجاهها قبل أي التزام.`,
      }
    : irr >= requiredRate
    ? {
        fr: `Le taux de rendement interne atteint ${fmtPct(irr, 2)}, contre ${fmtPct(requiredRate, 1)} exigés pour le projet. Il dépasse donc le seuil de rendement de ${fmtN(irr - requiredRate, 2)} points de pourcentage, ce qui confirme que la rentabilité attendue rémunère le risque au niveau demandé.`,
        ar: `يبلغ معدل العائد الداخلي ${fmtPct(irr, 2)} مقابل ${fmtPct(requiredRate, 1)} كعائد مطلوب للمشروع. وبذلك يتجاوز العتبة المطلوبة بفارق ${fmtN(irr - requiredRate, 2)} نقطة مئوية، مما يؤكد أن الربحية المتوقعة تعوّض المخاطر بالمستوى المطلوب.`,
      }
    : {
        fr: `Le taux de rendement interne atteint ${fmtPct(irr, 2)}, alors que le projet doit produire au moins ${fmtPct(requiredRate, 1)}. Il manque donc ${fmtN(requiredRate - irr, 2)} points de pourcentage pour atteindre le rendement exigé, ce qui appelle une amélioration des flux, du coût d'investissement ou des conditions de financement.`,
        ar: `يبلغ معدل العائد الداخلي ${fmtPct(irr, 2)}، بينما يجب أن يحقق المشروع عائداً لا يقل عن ${fmtPct(requiredRate, 1)}. لذلك ينقصه ${fmtN(requiredRate - irr, 2)} نقطة مئوية لبلوغ العائد المطلوب، مما يستدعي تحسين التدفقات أو خفض تكلفة الاستثمار أو مراجعة شروط التمويل.`,
      };

  const paybackParagraph = simplePayback !== null
    ? {
        fr: `Le capital initial est récupéré après ${fmtYears(simplePayback, "fr")}, sur une durée de projet de ${projectDuration} ans${discountedPayback !== null ? ` ; en tenant compte de la valeur temps de l'argent, la récupération intervient après ${fmtYears(discountedPayback, "fr")}` : ", mais la récupération actualisée n'est pas atteinte dans la durée prévue"}. ${simplePayback < projectDuration ? "Cette récupération avant la fin du projet limite l'immobilisation du capital, même si les flux doivent rester suivis jusqu'au terme." : "Une récupération tardive laisse le capital exposé plus longtemps aux retards et aux écarts de trésorerie."}`,
        ar: `يُسترد رأس المال الأولي بعد ${fmtYears(simplePayback, "ar")} من مدة مشروع تبلغ ${projectDuration} سنوات${discountedPayback !== null ? `؛ ومع احتساب القيمة الزمنية للنقود، يحدث الاسترداد بعد ${fmtYears(discountedPayback, "ar")}` : "، لكن الاسترداد المخصوم لا يتحقق ضمن المدة المتوقعة"}. ${simplePayback < projectDuration ? "ويحدّ الاسترداد قبل نهاية المشروع من تجميد رأس المال، مع ضرورة متابعة التدفقات حتى النهاية." : "ويُبقي الاسترداد المتأخر رأس المال معرضاً لفترة أطول لتأخر التدفقات واضطراب السيولة."}`,
      }
    : {
        fr: `Le capital initial n'est pas récupéré pendant les ${projectDuration} ans du projet, même avant prise en compte de la valeur temps de l'argent. Cette absence de récupération augmente fortement l'exposition au risque : un retard ou une baisse des flux peut rendre la perte durable et le projet doit être revu avant engagement.`,
        ar: `لا يُسترد رأس المال الأولي خلال مدة المشروع البالغة ${projectDuration} سنوات، حتى قبل احتساب القيمة الزمنية للنقود. ويزيد غياب الاسترداد من التعرض للمخاطر بشكل كبير؛ فأي تأخر أو انخفاض في التدفقات قد يجعل الخسارة مستديمة، لذلك يجب مراجعة المشروع قبل الالتزام.`,
      };

  return {
    fr: [npvParagraphs.fr, irrParagraph.fr, paybackParagraph.fr],
    ar: [npvParagraphs.ar, irrParagraph.ar, paybackParagraph.ar],
  };
}