import {
  type Static,
  Type,
} from '@sinclair/typebox';

/** ----- eva-run ----- */
export const ASSERT_NAMES = {
  BEVAL: 'b-eval',
  GEVAL: 'g-eval',
  LLM_RUBRIC: 'llm-rubric',
  EQUALS: 'equals',
  NOT_EQUALS: 'not-equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not-contains',
  REGEX: 'regex',
} as const;

export const AssertNameEnum = Type.Union(
  Object.values(ASSERT_NAMES).map((val) => Type.Literal(val))
);

export type TAssertName = (typeof ASSERT_NAMES)[keyof typeof ASSERT_NAMES];

export const AssertSchema = Type.Object({
  name: AssertNameEnum,
  criteria: Type.String(),
  threshold: Type.Optional(Type.Number()),
  // llm-as-judge fields
  provider: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  options: Type.Optional(Type.Record(Type.String(), Type.Any())),
  must_fail: Type.Optional(Type.Boolean()),
  // G-Eval/B-Eval fields
  answer_only: Type.Optional(Type.Boolean()),
  // text compare fields
  case_sensitive: Type.Optional(Type.Boolean()),
});
export type TAssertSchema = Static<typeof AssertSchema>;

const BaseTest = Type.Object({
  run_id: Type.String({ format: 'uuid' }),
  test_id: Type.Optional(Type.String({ format: 'uuid' })),
  prompt: Type.String(),
  asserts: Type.Array(AssertSchema),
});

const LiveTest = Type.Intersect([
  BaseTest,
  Type.Object({
    provider: Type.String(),
    model: Type.String(),
    options: Type.Optional(Type.Record(Type.String(), Type.Any())),
  }),
]);

const AuditTest = Type.Intersect([
  BaseTest,
  Type.Object({
    output: Type.String(),
  }),
]);

export const TestSchema = Type.Union([LiveTest, AuditTest]);
export type TTestSchema = Static<typeof TestSchema>;

export const EvalResponse = Type.Object({
  test_ids: Type.Array(Type.String({ format: 'uuid' })),
});
export type TEvalResponse = Static<typeof EvalResponse>;
/** ----- eva-run ----- */

export const HealthResponse = Type.Object({
  status: Type.String(),
});
export type THealthResponse = Static<typeof HealthResponse>;

export const RunRequest = Type.Object({
  run_id: Type.String({ format: 'uuid' }),
});
export type TRunRequest = Static<typeof RunRequest>;

export const RunResponse = Type.Object({
  status: Type.Union([
    Type.Literal('queued'),
    Type.Literal('run'),
  ]),
  run_id: Type.String({ format: 'uuid' }),
});
export type TRunResponse = Static<typeof RunResponse>;

export const CurrentRunResponse = Type.Object({
  run_id: Type.Union([
    Type.String({ format: 'uuid' }),
    Type.Null(),
  ]),
});
export type TCurrentRunResponse = Static<typeof CurrentRunResponse>;

export const RunsQueueResponse = Type.Object({
  run_ids: Type.Array(Type.String({ format: 'uuid' })),
});
export type TRunsQueueResponse = Static<typeof RunsQueueResponse>;

export const NodesResponse = Type.Object({
  nodes: Type.Record(Type.String(), Type.String()),
});
export type TNodesResponse = Static<typeof NodesResponse>;

export interface ITestRun {
  run_id: string;
  test_id: string;
  test_config: string;
}
