import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useProblemState } from "@/lib/ProblemContext";
import { useGetTemplate, useSolveProblem } from "@workspace/api-client-react";
import type { Variable, Constraint, ProblemInput, ConstraintOperator } from "@workspace/api-client-react";
import { TemplateSelector } from "@/components/TemplateSelector";
import type { SectorKey } from "@/components/TemplateSelector";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator, Loader2, ArrowLeft, RotateCcw, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SECTOR_LABELS: Record<SectorKey, { fr: string; ar: string }> = {
  industry:    { fr: "Industrie",    ar: "صناعة" },
  trade:       { fr: "Commerce",     ar: "تجارة" },
  services:    { fr: "Services",     ar: "خدمات" },
  agriculture: { fr: "Agriculture",  ar: "فلاحة" },
  custom:      { fr: "Personnalisé", ar: "مخصص" },
};

type Step = "select" | "form";

export default function Solve() {
  const { t, language } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const urlTemplate = params.get("template") as SectorKey | null;

  const [step, setStep] = useState<Step>(urlTemplate ? "form" : "select");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setInputAndResult } = useProblemState();

  const [sector, setSector] = useState<SectorKey>(urlTemplate || "custom");
  const [name, setName] = useState("");
  const [objectiveType, setObjectiveType] = useState<"maximize" | "minimize">("maximize");
  const [variables, setVariables] = useState<Variable[]>([
    { name: "X1", coefficient: 0, unit: "" },
    { name: "X2", coefficient: 0, unit: "" },
  ]);
  const [constraints, setConstraints] = useState<Constraint[]>([
    { name: "C1", coefficients: [0, 0], operator: "<=", rhs: 0, unit: "" },
  ]);

  const { data: templateData, isFetching: templateLoading } = useGetTemplate(sector, {
    query: { enabled: sector !== "custom" },
  });

  const solveMutation = useSolveProblem({
    mutation: {
      onSuccess: (data, variablesInput) => {
        setInputAndResult(variablesInput.data, data);
        setLocation("/simplex/results");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("Erreur", "خطأ"),
          description: t("Erreur lors de la résolution du problème.", "حدث خطأ أثناء حل المسألة."),
        });
      },
    },
  });

  useEffect(() => {
    if (templateData && sector !== "custom") {
      setName(language === "ar" ? templateData.nameAr : templateData.name);
      setObjectiveType(templateData.objectiveType as "maximize" | "minimize");
      setVariables(
        templateData.variables.map((v) => ({
          name: language === "ar" ? v.nameAr : v.name,
          coefficient: v.coefficient,
          unit: v.unit || "",
        }))
      );
      setConstraints(
        templateData.constraints.map((c) => ({
          name: language === "ar" ? c.nameAr : c.name,
          coefficients: [...c.coefficients],
          operator: c.operator as ConstraintOperator,
          rhs: c.rhs,
          unit: c.unit || "",
        }))
      );
    } else if (sector === "custom") {
      setName("");
      setVariables([
        { name: "X1", coefficient: 0, unit: "" },
        { name: "X2", coefficient: 0, unit: "" },
      ]);
      setConstraints([{ name: "C1", coefficients: [0, 0], operator: "<=", rhs: 0, unit: "" }]);
    }
  }, [templateData, sector, language]);

  // Sync constraint coefficients array length with variables length
  useEffect(() => {
    setConstraints((prev) =>
      prev.map((c) => {
        const newCoefs = [...c.coefficients];
        while (newCoefs.length < variables.length) newCoefs.push(0);
        if (newCoefs.length > variables.length) newCoefs.length = variables.length;
        return { ...c, coefficients: newCoefs };
      })
    );
  }, [variables.length]);

  const handleTemplateSelect = (selected: SectorKey) => {
    setSector(selected);
    setStep("form");
  };

  const handleResetTemplate = () => {
    if (templateData && sector !== "custom") {
      setObjectiveType(templateData.objectiveType as "maximize" | "minimize");
      setVariables(
        templateData.variables.map((v) => ({
          name: language === "ar" ? v.nameAr : v.name,
          coefficient: v.coefficient,
          unit: v.unit || "",
        }))
      );
      setConstraints(
        templateData.constraints.map((c) => ({
          name: language === "ar" ? c.nameAr : c.name,
          coefficients: [...c.coefficients],
          operator: c.operator as ConstraintOperator,
          rhs: c.rhs,
          unit: c.unit || "",
        }))
      );
      toast({ title: t("Valeurs réinitialisées", "تم إعادة التعيين"), description: t("Les valeurs du modèle ont été restaurées.", "تم استعادة قيم النموذج.") });
    } else {
      setName("");
      setVariables([
        { name: "X1", coefficient: 0, unit: "" },
        { name: "X2", coefficient: 0, unit: "" },
      ]);
      setConstraints([{ name: "C1", coefficients: [0, 0], operator: "<=", rhs: 0, unit: "" }]);
    }
  };

  const addVariable = () => {
    setVariables([...variables, { name: `X${variables.length + 1}`, coefficient: 0, unit: "" }]);
  };

  const removeVariable = (index: number) => {
    if (variables.length <= 1) return;
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | number) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const addConstraint = () => {
    setConstraints([
      ...constraints,
      {
        name: `C${constraints.length + 1}`,
        coefficients: Array(variables.length).fill(0),
        operator: "<=",
        rhs: 0,
        unit: "",
      },
    ]);
  };

  const removeConstraint = (index: number) => {
    if (constraints.length <= 1) return;
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const updateConstraint = (index: number, field: keyof Constraint, value: any) => {
    const newConst = [...constraints];
    newConst[index] = { ...newConst[index], [field]: value };
    setConstraints(newConst);
  };

  const updateConstraintCoef = (constraintIndex: number, varIndex: number, value: number) => {
    const newConst = [...constraints];
    newConst[constraintIndex].coefficients[varIndex] = value;
    setConstraints(newConst);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ProblemInput = {
      name: name || t("Problème personnalisé", "مسألة مخصصة"),
      sector: sector as any,
      objectiveType,
      variables,
      constraints,
      language: language as any,
    };
    solveMutation.mutate({ data: payload });
  };

  if (step === "select") {
    return <TemplateSelector onSelect={handleTemplateSelect} />;
  }

  const sectorLabel = SECTOR_LABELS[sector];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      {/* Step header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setStep("select")}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("Retour au choix du secteur", "العودة إلى اختيار القطاع")}
          >
            <ChevronLeft className={cn("w-5 h-5", language === "ar" && "rotate-180")} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold text-foreground">
                {t("Définir le Problème", "تحديد المسألة")}
              </h1>
              <Badge variant="secondary" className="text-sm font-medium">
                {language === "ar" ? sectorLabel.ar : sectorLabel.fr}
                {sector !== "custom" && (
                  <span className="ml-1 opacity-60">
                    · {language === "ar" ? sectorLabel.fr : sectorLabel.ar}
                  </span>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {sector === "custom"
                ? t("Entrez vos propres paramètres.", "أدخل معلماتك الخاصة.")
                : t("Modèle pré-rempli — vous pouvez modifier les valeurs.", "نموذج مُعبَّأ مسبقاً — يمكنك تعديل القيم.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleResetTemplate}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {t("Réinitialiser", "إعادة التعيين")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("select")}>
            <ArrowLeft className={cn("w-4 h-4 mr-1.5", language === "ar" && "rotate-180")} />
            {t("Changer de secteur", "تغيير القطاع")}
          </Button>
        </div>
      </div>

      {templateLoading ? (
        <Card>
          <CardContent className="py-24 flex justify-center items-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General info */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Informations Générales", "معلومات عامة")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t("Nom du problème", "اسم المسألة")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Ex: Planification de production Alger", "مثال: تخطيط إنتاج الجزائر")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Objectif", "الهدف")}</Label>
                <RadioGroup
                  value={objectiveType}
                  onValueChange={(v: any) => setObjectiveType(v)}
                  className="flex gap-6 pt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="maximize" id="max" />
                    <Label htmlFor="max" className="cursor-pointer">
                      {t("Maximiser (Profit, Revenu)", "تعظيم (الربح، العائد)")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="minimize" id="min" />
                    <Label htmlFor="min" className="cursor-pointer">
                      {t("Minimiser (Coût, Temps)", "تقليل (التكلفة، الوقت)")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Variables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("Variables de Décision", "متغيرات القرار")}</CardTitle>
                <CardDescription>
                  {t("Les éléments sur lesquels vous pouvez agir.", "العناصر التي يمكنك التصرف بشأنها.")}
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                <Plus className="w-4 h-4 mr-2" />
                {t("Ajouter", "إضافة")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[2fr_2fr_1fr_auto] gap-4 font-medium text-sm text-muted-foreground px-2">
                <div>{t("Nom", "الاسم")}</div>
                <div>{t("Coefficient (Z)", "المعامل (Z)")}</div>
                <div>{t("Unité", "الوحدة")}</div>
                <div className="w-10" />
              </div>
              {variables.map((v, i) => (
                <div key={i} className="grid grid-cols-[2fr_2fr_1fr_auto] gap-4 items-center">
                  <Input
                    value={v.name}
                    onChange={(e) => updateVariable(i, "name", e.target.value)}
                    placeholder="X1"
                    required
                  />
                  <Input
                    type="number"
                    step="any"
                    value={v.coefficient}
                    onChange={(e) => updateVariable(i, "coefficient", parseFloat(e.target.value) || 0)}
                    required
                  />
                  <Input
                    value={v.unit || ""}
                    onChange={(e) => updateVariable(i, "unit", e.target.value)}
                    placeholder={t("DA/u...", "دج/و...")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVariable(i)}
                    disabled={variables.length <= 1}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Constraints */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("Contraintes", "القيود")}</CardTitle>
                <CardDescription>
                  {t("Vos limitations en ressources, temps, capacité, etc.", "قيودك في الموارد والوقت والسعة وغيرها.")}
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addConstraint}>
                <Plus className="w-4 h-4 mr-2" />
                {t("Ajouter", "إضافة")}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-4">
                <div className="min-w-max space-y-4">
                  <div className="flex gap-4 font-medium text-sm text-muted-foreground px-2">
                    <div className="w-48">{t("Nom", "الاسم")}</div>
                    {variables.map((v, i) => (
                      <div key={i} className="w-24 text-center truncate px-1" title={v.name}>
                        {v.name || `X${i + 1}`}
                      </div>
                    ))}
                    <div className="w-20 text-center">{t("Type", "النوع")}</div>
                    <div className="w-32">{t("Limite", "الحد")}</div>
                    <div className="w-32">{t("Unité", "الوحدة")}</div>
                    <div className="w-10" />
                  </div>

                  {constraints.map((c, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-48">
                        <Input
                          value={c.name}
                          onChange={(e) => updateConstraint(i, "name", e.target.value)}
                          placeholder="C1"
                          required
                        />
                      </div>
                      {variables.map((_, varIdx) => (
                        <div key={varIdx} className="w-24">
                          <Input
                            type="number"
                            step="any"
                            value={c.coefficients[varIdx] || 0}
                            onChange={(e) =>
                              updateConstraintCoef(i, varIdx, parseFloat(e.target.value) || 0)
                            }
                            required
                          />
                        </div>
                      ))}
                      <div className="w-20">
                        <Select
                          value={c.operator}
                          onValueChange={(val) => updateConstraint(i, "operator", val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="<=">&le;</SelectItem>
                            <SelectItem value=">=">&ge;</SelectItem>
                            <SelectItem value="=">=</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="any"
                          value={c.rhs}
                          onChange={(e) =>
                            updateConstraint(i, "rhs", parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          value={c.unit || ""}
                          onChange={(e) => updateConstraint(i, "unit", e.target.value)}
                          placeholder={t("kg...", "كغ...")}
                        />
                      </div>
                      <div className="w-10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeConstraint(i)}
                          disabled={constraints.length <= 1}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto px-8"
              disabled={solveMutation.isPending}
            >
              {solveMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Calculator className="w-5 h-5 mr-2" />
              )}
              {t("Résoudre", "حل المسألة")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
