// ── Workshop Scheduling (Ordonnancement des Ateliers) — pure computation ───────
// Supports three single-machine sequencing rules: SPT, EDD, FIFO.
// No i18n here; all user-facing strings live in the UI layer.

export type SchedulingRule = "SPT" | "EDD" | "FIFO";

// ── Input shapes ──────────────────────────────────────────────────────────────
export interface TaskInput {
  id: string;
  name: string;
  duration: number;       // temps de traitement (processing time)
  dueDate: number;        // date d'échéance (due date)
  arrivalDate: number;    // date d'arrivée (0 for SPT/EDD — all available at t=0)
}

// ── Output shapes ─────────────────────────────────────────────────────────────
export interface ScheduledTask {
  rank: number;           // position in the execution sequence (1-based)
  taskId: string;
  name: string;
  duration: number;
  dueDate: number;
  arrivalDate: number;
  startTime: number;      // when machine begins processing this task
  completionTime: number; // when the task finishes (start + duration)
  delay: number;          // max(0, completionTime − dueDate)
}

export interface SchedulingResults {
  rule: SchedulingRule;
  sequence: ScheduledTask[];
  avgCompletionTime: number; // average completion time across all tasks
  avgDelay: number;          // average delay across all tasks
  maxDelay: number;          // maximum delay (worst task)
  totalDuration: number;     // sum of all durations
  makespan: number;          // time the machine finishes everything
}

// ── Validation ────────────────────────────────────────────────────────────────
export interface ValidationError {
  type: "empty" | "zero_duration" | "missing_fields";
  taskName?: string;
  msgFr: string;
  msgAr: string;
}

export function validateTasks(tasks: TaskInput[], rule: SchedulingRule): ValidationError[] {
  const errors: ValidationError[] = [];

  if (tasks.length === 0) {
    errors.push({
      type: "empty",
      msgFr: "Aucune tâche saisie. Ajoutez au moins une tâche pour lancer la planification.",
      msgAr: "لم يتم إدخال أي مهمة. أضف مهمة واحدة على الأقل لبدء الجدولة.",
    });
    return errors;
  }

  for (const task of tasks) {
    if (!task.name.trim()) {
      errors.push({
        type: "missing_fields",
        taskName: task.name || "?",
        msgFr: "Une tâche n'a pas de nom. Veuillez nommer toutes les tâches.",
        msgAr: "إحدى المهام ليس لها اسم. يرجى تسمية جميع المهام.",
      });
    }
    if (task.duration <= 0) {
      errors.push({
        type: "zero_duration",
        taskName: task.name || "?",
        msgFr: `La tâche "${task.name || "?"}" a une durée nulle ou invalide. Saisissez une durée supérieure à 0.`,
        msgAr: `المهمة "${task.name || "?"}" لها مدة معالجة صفرية أو غير صحيحة. أدخل قيمة أكبر من 0.`,
      });
    }
    if (rule === "FIFO" && task.arrivalDate < 0) {
      errors.push({
        type: "missing_fields",
        taskName: task.name || "?",
        msgFr: `La tâche "${task.name || "?"}" a une date d'arrivée négative.`,
        msgAr: `المهمة "${task.name || "?"}" لها تاريخ وصول سالب.`,
      });
    }
  }

  return errors;
}

// ── Sequencing rules ──────────────────────────────────────────────────────────
function sortBySpt(tasks: TaskInput[]): TaskInput[] {
  return [...tasks].sort((a, b) => a.duration - b.duration || a.name.localeCompare(b.name));
}

function sortByEdd(tasks: TaskInput[]): TaskInput[] {
  return [...tasks].sort((a, b) => a.dueDate - b.dueDate || a.name.localeCompare(b.name));
}

function sortByFifo(tasks: TaskInput[]): TaskInput[] {
  return [...tasks].sort((a, b) => a.arrivalDate - b.arrivalDate || a.name.localeCompare(b.name));
}

// ── Schedule computation ──────────────────────────────────────────────────────
export function computeSchedule(
  tasks: TaskInput[],
  rule: SchedulingRule,
): SchedulingResults {
  // 1. Sort according to the selected rule
  let ordered: TaskInput[];
  if (rule === "SPT")      ordered = sortBySpt(tasks);
  else if (rule === "EDD") ordered = sortByEdd(tasks);
  else                     ordered = sortByFifo(tasks);

  // 2. Simulate the single machine
  const sequence: ScheduledTask[] = [];
  let machineAvailable = 0; // time the machine becomes free

  for (let i = 0; i < ordered.length; i++) {
    const task = ordered[i];

    // For SPT/EDD all tasks arrive at t=0; for FIFO we respect arrival dates.
    const arrival = rule === "FIFO" ? task.arrivalDate : 0;
    const startTime = Math.max(machineAvailable, arrival);
    const completionTime = startTime + task.duration;
    const delay = Math.max(0, completionTime - task.dueDate);

    sequence.push({
      rank: i + 1,
      taskId: task.id,
      name: task.name,
      duration: task.duration,
      dueDate: task.dueDate,
      arrivalDate: task.arrivalDate,
      startTime,
      completionTime,
      delay,
    });

    machineAvailable = completionTime;
  }

  const n = sequence.length;
  const avgCompletionTime = n > 0
    ? sequence.reduce((s, t) => s + t.completionTime, 0) / n
    : 0;
  const avgDelay = n > 0
    ? sequence.reduce((s, t) => s + t.delay, 0) / n
    : 0;
  const maxDelay = n > 0
    ? Math.max(...sequence.map(t => t.delay))
    : 0;
  const totalDuration = tasks.reduce((s, t) => s + t.duration, 0);
  const makespan = n > 0 ? sequence[n - 1].completionTime : 0;

  return { rule, sequence, avgCompletionTime, avgDelay, maxDelay, totalDuration, makespan };
}

// ── Bilingual analysis generator ──────────────────────────────────────────────
export function generateSchedulingAnalysis(
  results: SchedulingResults,
): Array<{ fr: string; ar: string }> {
  const lines: Array<{ fr: string; ar: string }> = [];
  const { sequence, rule, avgDelay, maxDelay } = results;

  const delayedTasks = sequence.filter(t => t.delay > 0);
  const onTimeTasks  = sequence.filter(t => t.delay === 0);

  // Overall picture
  if (delayedTasks.length === 0) {
    lines.push({
      fr: `✅ Résultat optimal — Toutes les ${sequence.length} tâches sont livrées dans les délais. Aucun retard enregistré avec la règle ${rule}.`,
      ar: `✅ نتيجة مثالية — جميع المهام الـ ${sequence.length} تُسلَّم في الوقت المحدد. لا تأخير مسجّل باستخدام قاعدة ${rule}.`,
    });
  } else {
    lines.push({
      fr: `⚠ ${delayedTasks.length} tâche(s) sur ${sequence.length} enregistrent un retard avec la règle ${rule}. ${onTimeTasks.length} tâche(s) sont dans les délais.`,
      ar: `⚠ ${delayedTasks.length} مهمة(مهام) من أصل ${sequence.length} تُسجّل تأخيراً باستخدام قاعدة ${rule}. ${onTimeTasks.length} مهمة(مهام) في الوقت المحدد.`,
    });
  }

  // Worst offender
  if (delayedTasks.length > 0) {
    const worst = delayedTasks.reduce((a, b) => b.delay > a.delay ? b : a);
    lines.push({
      fr: `🔴 La tâche "${worst.name}" génère le retard le plus élevé : ${worst.delay.toFixed(1)} unités (échéance ${worst.dueDate}, fin réelle ${worst.completionTime.toFixed(1)}).`,
      ar: `🔴 المهمة "${worst.name}" تُسجّل أعلى تأخير: ${worst.delay.toFixed(1)} وحدة (الأجل ${worst.dueDate}، الإنهاء الفعلي ${worst.completionTime.toFixed(1)}).`,
    });

    // Secondary delayed tasks
    const others = delayedTasks.filter(t => t.taskId !== worst.taskId);
    if (others.length > 0) {
      const names = others.map(t => `"${t.name}"`).join(", ");
      lines.push({
        fr: `🟡 Autres tâches en retard : ${names}.`,
        ar: `🟡 مهام أخرى متأخرة: ${names}.`,
      });
    }
  }

  // Average metrics
  lines.push({
    fr: `📊 Temps de fin moyen : ${results.avgCompletionTime.toFixed(1)} — Retard moyen : ${avgDelay.toFixed(1)} — Retard maximal : ${maxDelay.toFixed(1)}.`,
    ar: `📊 متوسط وقت الإنهاء: ${results.avgCompletionTime.toFixed(1)} — متوسط التأخير: ${avgDelay.toFixed(1)} — أقصى تأخير: ${maxDelay.toFixed(1)}.`,
  });

  // Rule-specific observation
  if (rule === "SPT") {
    lines.push({
      fr: `ℹ La règle SPT minimise le temps de fin moyen et le nombre moyen de tâches en cours, mais peut pénaliser les longues tâches à échéance serrée.`,
      ar: `ℹ قاعدة SPT تُقلّل متوسط وقت الإنهاء وعدد المهام قيد التنفيذ، لكنها قد تُعاقب المهام الطويلة ذات الآجال المحدودة.`,
    });
  } else if (rule === "EDD") {
    lines.push({
      fr: `ℹ La règle EDD minimise le retard maximal — elle est optimale pour réduire le risque de la pire livraison en retard.`,
      ar: `ℹ قاعدة EDD تُقلّل التأخير الأقصى — وهي الأمثل للحدّ من مخاطر أسوأ تسليم متأخر.`,
    });
  } else {
    lines.push({
      fr: `ℹ La règle FIFO traite les tâches dans leur ordre d'arrivée — simple et équitable, mais pas nécessairement optimale pour minimiser les retards.`,
      ar: `ℹ قاعدة FIFO تعالج المهام بترتيب وصولها — بسيطة وعادلة، لكنها ليست بالضرورة الأمثل لتقليل التأخيرات.`,
    });
  }

  return lines;
}

// ── Bilingual dynamic recommendations generator ───────────────────────────────
export function generateSchedulingRecommendations(
  results: SchedulingResults,
): Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> {
  const recos: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> = [];
  const { sequence, rule } = results;

  const delayedTasks = sequence.filter(t => t.delay > 0);
  const onTimeTasks  = sequence.filter(t => t.delay === 0);

  if (delayedTasks.length === 0) {
    // No delays — everything on time
    recos.push({
      icon: "✅",
      fr: "Maintenir cette séquence d'ordonnancement",
      ar: "الحفاظ على تسلسل الجدولة الحالي",
      descFr: `La règle ${rule} donne un ordonnancement sans aucun retard pour cet ensemble de tâches. Appliquez cette séquence telle quelle en atelier.`,
      descAr: `قاعدة ${rule} تُعطي جدولة بلا أي تأخير لهذه المجموعة من المهام. طبّق هذا التسلسل كما هو في ورشة العمل.`,
    });

    recos.push({
      icon: "📋",
      fr: "Mettre à jour le plan si de nouvelles tâches arrivent",
      ar: "تحديث الخطة عند وصول مهام جديدة",
      descFr: "Toute nouvelle tâche insérée en cours de production peut remettre en cause cet équilibre. Relancez le calcul d'ordonnancement dès qu'une commande urgente est ajoutée.",
      descAr: "أي مهمة جديدة تُدرج أثناء الإنتاج يمكن أن تُخلّ بهذا التوازن. أعد حساب الجدولة فور إضافة طلب عاجل.",
    });

    return recos;
  }

  // There are delays — generate specific recommendations for each delayed task
  const worst = delayedTasks.reduce((a, b) => b.delay > a.delay ? b : a);

  recos.push({
    icon: "🚨",
    fr: `Négocier le délai de "${worst.name}" (retard : ${worst.delay.toFixed(1)} unités)`,
    ar: `التفاوض على أجل "${worst.name}" (التأخير: ${worst.delay.toFixed(1)} وحدة)`,
    descFr: `Cette tâche est la plus critique : elle se termine avec ${worst.delay.toFixed(1)} unités de retard sur son échéance (${worst.dueDate}). Contactez le client ou révisez l'échéance en priorité.`,
    descAr: `هذه المهمة هي الأكثر حرجاً: تنتهي بتأخير ${worst.delay.toFixed(1)} وحدة عن أجلها (${worst.dueDate}). تواصل مع العميل أو أعد النظر في الأجل كأولوية.`,
  });

  if (delayedTasks.length > 1) {
    const others = delayedTasks.filter(t => t.taskId !== worst.taskId);
    const namesAr = others.map(t => `"${t.name}" (${t.delay.toFixed(1)})`).join("، ");
    const namesFr = others.map(t => `"${t.name}" (retard ${t.delay.toFixed(1)})`).join(", ");
    recos.push({
      icon: "⏱",
      fr: `Réduire la durée de traitement des tâches en retard`,
      ar: `تقليص مدة معالجة المهام المتأخرة`,
      descFr: `Les tâches suivantes génèrent également des retards : ${namesFr}. Envisagez des heures supplémentaires, une sous-traitance partielle ou un réaménagement de la charge de travail.`,
      descAr: `المهام التالية تُسجّل أيضاً تأخيرات: ${namesAr}. ادرس العمل الإضافي أو المناولة الجزئية أو إعادة توزيع حجم العمل.`,
    });
  }

  // Rule-specific alternative suggestion
  if (rule === "SPT") {
    recos.push({
      icon: "🔄",
      fr: "Tester la règle EDD pour réduire le retard maximal",
      ar: "تجربة قاعدة EDD لتقليل التأخير الأقصى",
      descFr: "La règle EDD est connue pour minimiser le retard maximal. Comparez les résultats des deux règles pour choisir la séquence la mieux adaptée aux pénalités contractuelles.",
      descAr: "قاعدة EDD معروفة بتقليل التأخير الأقصى. قارن نتائج القاعدتين لاختيار التسلسل الأنسب للغرامات التعاقدية.",
    });
  } else if (rule === "EDD") {
    recos.push({
      icon: "🔄",
      fr: "Tester la règle SPT pour réduire le temps de fin moyen",
      ar: "تجربة قاعدة SPT لتقليل متوسط وقت الإنهاء",
      descFr: "Si les pénalités de retard sont uniformes, la règle SPT minimise le nombre de tâches en cours et le temps de fin moyen. Comparez les deux séquences.",
      descAr: "إذا كانت غرامات التأخير موحّدة، فإن قاعدة SPT تُقلّل عدد المهام قيد التنفيذ ومتوسط وقت الإنهاء. قارن التسلسلين.",
    });
  } else {
    recos.push({
      icon: "🔄",
      fr: "Envisager SPT ou EDD à la place de FIFO",
      ar: "النظر في SPT أو EDD بدلاً من FIFO",
      descFr: "La règle FIFO est simple mais rarement optimale. Comparez avec SPT (minimise le temps moyen) ou EDD (minimise le retard maximal) pour identifier de meilleures séquences.",
      descAr: "قاعدة FIFO بسيطة لكنها نادراً ما تكون الأمثل. قارنها بـSPT (تقليل متوسط الوقت) أو EDD (تقليل التأخير الأقصى) لتحديد تسلسلات أفضل.",
    });
  }

  if (onTimeTasks.length > 0) {
    recos.push({
      icon: "📌",
      fr: "Protéger les tâches livrées dans les délais",
      ar: "حماية المهام المُسلَّمة في الوقت المحدد",
      descFr: `${onTimeTasks.length} tâche(s) sont actuellement dans les délais (${onTimeTasks.map(t => `"${t.name}"`).join(", ")}). Évitez d'y insérer des tâches urgentes qui pourraient les retarder.`,
      descAr: `${onTimeTasks.length} مهمة(مهام) في الوقت المحدد حالياً (${onTimeTasks.map(t => `"${t.name}"`).join("، ")}). تجنّب إدراج مهام عاجلة قد تؤخرها.`,
    });
  }

  return recos;
}
