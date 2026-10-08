import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IAutomationFlowDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  triggerType: string;
  triggerConfig?: Record<string, any>;
  flowDefinition?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationFlowSchema = new Schema<IAutomationFlowDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    triggerType: { type: String, required: true },
    triggerConfig: { type: Schema.Types.Mixed, default: {} },
    flowDefinition: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

AutomationFlowSchema.virtual("id").get(function () {
  return this._id;
});

export const AutomationFlowModel =
  mongoose.models.AutomationFlow ||
  mongoose.model<IAutomationFlowDocument>("AutomationFlow", AutomationFlowSchema);

export interface IAutomationFlowRunDocument extends Document {
  id: string;
  flowId: string;
  organizationId?: string;
  contactId?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

const AutomationFlowRunSchema = new Schema<IAutomationFlowRunDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    flowId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    contactId: { type: String, index: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "cancelled"],
      default: "running",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    error: { type: String },
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

AutomationFlowRunSchema.virtual("id").get(function () {
  return this._id;
});

export const AutomationFlowRunModel =
  mongoose.models.AutomationFlowRun ||
  mongoose.model<IAutomationFlowRunDocument>("AutomationFlowRun", AutomationFlowRunSchema);

export interface IDripCampaignDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  steps: any[];
  triggerConfig?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DripCampaignSchema = new Schema<IDripCampaignDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
      index: true,
    },
    steps: { type: Schema.Types.Mixed, default: [] },
    triggerConfig: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

DripCampaignSchema.virtual("id").get(function () {
  return this._id;
});

export const DripCampaignModel =
  mongoose.models.DripCampaign ||
  mongoose.model<IDripCampaignDocument>("DripCampaign", DripCampaignSchema);

export interface IAutomationFlowScheduledRunDocument extends Document {
  id: string;
  flowId: string;
  userId: string;
  organizationId?: string;
  runId?: string;
  nextNodeId?: string;
  resumeAt: Date;
  runContext?: Record<string, any>;
  visitedNodeIds?: string[];
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationFlowScheduledRunSchema = new Schema<IAutomationFlowScheduledRunDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    flowId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    organizationId: { type: String, index: true },
    runId: { type: String },
    nextNodeId: { type: String },
    resumeAt: { type: Date, required: true, index: true },
    runContext: { type: Schema.Types.Mixed, default: {} },
    visitedNodeIds: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    lastError: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

AutomationFlowScheduledRunSchema.virtual("id").get(function () {
  return this._id;
});

export const AutomationFlowScheduledRunModel =
  mongoose.models.AutomationFlowScheduledRun ||
  mongoose.model<IAutomationFlowScheduledRunDocument>(
    "AutomationFlowScheduledRun",
    AutomationFlowScheduledRunSchema
  );

