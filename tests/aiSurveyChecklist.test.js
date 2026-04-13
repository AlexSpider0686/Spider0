import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SYSTEM, DEFAULT_ZONE } from "../src/config/estimateConfig.js";
import { buildAiSurveyPlan, calculateAiSurveyCompletion, getEnabledSurveyQuestions } from "../src/lib/aiTechnicalChecklist.js";
import { estimateSurveyZoneCount } from "../src/lib/aiTechnicalConfigurator.js";

function createSurveyFixture() {
  const objectData = {
    objectType: "public",
    totalArea: 4200,
    floors: 3,
    buildingStatus: "operational",
  };
  const zones = [DEFAULT_ZONE(1, "Офис", "office", 2200, 3), DEFAULT_ZONE(2, "Коридоры", "corridor", 2000, 3)];
  const systems = [{ ...DEFAULT_SYSTEM(1, "aps") }];
  const plan = buildAiSurveyPlan({
    objectData,
    zones,
    systems,
    protectedArea: 4200,
  });
  return { objectData, zones, systems, plan };
}

function buildCompletedAnswers(plan) {
  const answers = {};
  for (const question of getEnabledSurveyQuestions(plan, {})) {
    if (question.required === false) continue;
    if (question.type === "boolean") {
      answers[question.id] = true;
      continue;
    }
    if (question.type === "number") {
      answers[question.id] = 1;
      continue;
    }
    if (question.type === "multiselect") {
      answers[question.id] = [question.options?.[0]].filter(Boolean);
      continue;
    }
    answers[question.id] = "ok";
  }
  return answers;
}

test("survey completion drops after clearing a required numeric answer", () => {
  const { plan } = createSurveyFixture();
  const answers = buildCompletedAnswers(plan);
  const requiredNumber = getEnabledSurveyQuestions(plan, answers).find(
    (question) => question.required !== false && question.type === "number" && question.aiAutofill === true
  );
  const prompt = plan.photoPrompts.find((item) => item.targetQuestionIds?.includes(requiredNumber?.id));
  const photoAnalyses = prompt
    ? {
        [prompt.id]: {
          state: "success",
          accepted: true,
        },
      }
    : {};

  assert.ok(requiredNumber, "expected at least one required number question");
  assert.ok(prompt, "expected a photo prompt for the required numeric question");
  assert.equal(calculateAiSurveyCompletion(plan, answers, photoAnalyses).percent, 100);

  answers[requiredNumber.id] = undefined;
  const completion = calculateAiSurveyCompletion(plan, answers, photoAnalyses);

  assert.ok(completion.percent < 100);
});

test("survey completion ignores disabled dependent answers after toggle reset", () => {
  const { plan } = createSurveyFixture();
  const answers = buildCompletedAnswers(plan);
  const toggleQuestion = plan.allQuestions.find((question) => question.id.endsWith("-mount-height-limit-enabled"));
  const dependentQuestion = plan.allQuestions.find((question) => question.id.endsWith("-mount-height-limit"));

  assert.ok(toggleQuestion && dependentQuestion, "expected dependent mount-height questions");

  answers[toggleQuestion.id] = true;
  answers[dependentQuestion.id] = 8;
  assert.equal(calculateAiSurveyCompletion(plan, answers).percent, 100);

  answers[toggleQuestion.id] = false;
  answers[dependentQuestion.id] = undefined;

  assert.equal(calculateAiSurveyCompletion(plan, answers).percent, 100);
});

test("survey completion can reach 100 without photos when only AI autofill fields remain", () => {
  const { plan } = createSurveyFixture();
  const answers = {};
  const requiredQuestions = getEnabledSurveyQuestions(plan, {}).filter((question) => question.required !== false && question.aiAutofill !== true);

  for (const question of requiredQuestions) {
    if (question.type === "boolean") {
      answers[question.id] = true;
      continue;
    }
    if (question.type === "number") {
      answers[question.id] = 1;
      continue;
    }
    if (question.type === "multiselect") {
      answers[question.id] = [question.options?.[0]].filter(Boolean);
      continue;
    }
    answers[question.id] = "ok";
  }

  assert.equal(calculateAiSurveyCompletion(plan, answers, {}).percent, 100);
});

test("APS survey question exposes auto-calculate and returns zone count from the existing algorithm", () => {
  const { objectData, zones, plan } = createSurveyFixture();
  const apsZoneQuestion = plan.allQuestions.find((question) => question.autoCalculate === "aps-zksps-zones");

  assert.ok(apsZoneQuestion, "expected APS auto-calculate question");

  const zoneCount = estimateSurveyZoneCount({
    systemType: "aps",
    objectData,
    zones,
    photoAnalyses: {},
  });

  assert.ok(zoneCount >= 1);
});
