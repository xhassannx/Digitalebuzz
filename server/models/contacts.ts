import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IManagedContactDocument extends Document {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ManagedContactSchema = new Schema<IManagedContactDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    name: { type: String },
    phone: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    email: { type: String },
    notes: { type: String },
    customFields: { type: Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
    source: { type: String },
  },
  {
    timestamps: true,
    strict: false,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        ret.phoneNumber = ret.phoneNumber || ret.phone;
        ret.phone = ret.phone || ret.phoneNumber;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

ManagedContactSchema.pre("validate", function () {
  if (!this.phone && (this as any).phoneNumber) {
    this.phone = (this as any).phoneNumber;
  } else if (!(this as any).phoneNumber && this.phone) {
    (this as any).phoneNumber = this.phone;
  }
});

ManagedContactSchema.index({ organizationId: 1, phone: 1 });
ManagedContactSchema.virtual("id").get(function () {
  return this._id;
});

export const ManagedContactModel =
  mongoose.models.ManagedContact ||
  mongoose.model<IManagedContactDocument>("ManagedContact", ManagedContactSchema);

export interface IContactTagDocument extends Document {
  id: string;
  organizationId: string;
  name: string;
  color?: string;
  createdAt: Date;
}

const ContactTagSchema = new Schema<IContactTagDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: "#3b82f6" },
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

ContactTagSchema.virtual("id").get(function () {
  return this._id;
});

export const ContactTagModel =
  mongoose.models.ContactTag || mongoose.model<IContactTagDocument>("ContactTag", ContactTagSchema);

export interface IContactNoteDocument extends Document {
  id: string;
  contactId: string;
  organizationId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactNoteSchema = new Schema<IContactNoteDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    contactId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    content: { type: String, required: true },
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

ContactNoteSchema.virtual("id").get(function () {
  return this._id;
});

export const ContactNoteModel =
  mongoose.models.ContactNote ||
  mongoose.model<IContactNoteDocument>("ContactNote", ContactNoteSchema);

export interface IContactReminderDocument extends Document {
  id: string;
  contactId: string;
  organizationId: string;
  userId: string;
  title: string;
  reminderAt: Date;
  isCompleted: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactReminderSchema = new Schema<IContactReminderDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    contactId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    title: { type: String, required: true },
    reminderAt: { type: Date, required: true, index: true },
    isCompleted: { type: Boolean, default: false },
    notes: { type: String },
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

ContactReminderSchema.virtual("id").get(function () {
  return this._id;
});

export const ContactReminderModel =
  mongoose.models.ContactReminder ||
  mongoose.model<IContactReminderDocument>("ContactReminder", ContactReminderSchema);

export interface IContactActivityLogDocument extends Document {
  id: string;
  contactId: string;
  organizationId: string;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ContactActivityLogSchema = new Schema<IContactActivityLogDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    contactId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
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

ContactActivityLogSchema.virtual("id").get(function () {
  return this._id;
});

export const ContactActivityLogModel =
  mongoose.models.ContactActivityLog ||
  mongoose.model<IContactActivityLogDocument>("ContactActivityLog", ContactActivityLogSchema);

export interface IGroupDocument extends Document {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroupDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
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

GroupSchema.virtual("id").get(function () {
  return this._id;
});

export const GroupModel = mongoose.models.Group || mongoose.model<IGroupDocument>("Group", GroupSchema);

export interface IGroupMemberDocument extends Document {
  id: string;
  groupId: string;
  contactId: string;
  createdAt: Date;
}

const GroupMemberSchema = new Schema<IGroupMemberDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    groupId: { type: String, required: true, index: true },
    contactId: { type: String, required: true, index: true },
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

GroupMemberSchema.index({ groupId: 1, contactId: 1 }, { unique: true });
GroupMemberSchema.virtual("id").get(function () {
  return this._id;
});

export const GroupMemberModel =
  mongoose.models.GroupMember ||
  mongoose.model<IGroupMemberDocument>("GroupMember", GroupMemberSchema);

export interface IContactColumnDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  label: string;
  type: string;
  options?: string[];
  visible: boolean;
  required: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ContactColumnSchema = new Schema<IContactColumnDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    label: { type: String, required: true },
    type: { type: String, default: "text" },
    options: { type: [String], default: [] },
    visible: { type: Boolean, default: true },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
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

ContactColumnSchema.virtual("id").get(function () {
  return this._id;
});

export const ContactColumnModel =
  mongoose.models.ContactColumn ||
  mongoose.model<IContactColumnDocument>("ContactColumn", ContactColumnSchema);

