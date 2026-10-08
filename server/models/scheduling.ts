import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IBookingCalendarDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  slug: string;
  durationMinutes: number;
  availability?: Record<string, any>;
  theme?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const BookingCalendarSchema = new Schema<IBookingCalendarDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String },
    hostUserId: { type: String },
    name: { type: String },
    title: { type: String },
    slug: { type: String, required: true, index: true },
    durationMinutes: { type: Number, default: 30 },
    description: { type: String },
    logoUrl: { type: String },
    integrationId: { type: String },
    whatsappSessionId: { type: String },
    availability: { type: Schema.Types.Mixed, default: {} },
    theme: { type: Schema.Types.Mixed, default: {} },
    isPublicDemo: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    maxBookingsPerSlot: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    strict: false,
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

BookingCalendarSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
BookingCalendarSchema.virtual("id").get(function () {
  return this._id;
});

export const BookingCalendarModel =
  mongoose.models.BookingCalendar ||
  mongoose.model<IBookingCalendarDocument>("BookingCalendar", BookingCalendarSchema);

export interface IScheduledMeetingDocument extends Document {
  id: string;
  calendarId: string;
  organizationId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  startTime: Date;
  endTime: Date;
  status: "scheduled" | "cancelled" | "completed";
  meetingUrl?: string;
  notes?: string;
  createdAt: Date;
}

const ScheduledMeetingSchema = new Schema<IScheduledMeetingDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    calendarId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
      index: true,
    },
    meetingUrl: { type: String },
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

ScheduledMeetingSchema.virtual("id").get(function () {
  return this._id;
});

export const ScheduledMeetingModel =
  mongoose.models.ScheduledMeeting ||
  mongoose.model<IScheduledMeetingDocument>("ScheduledMeeting", ScheduledMeetingSchema);

export { IntegrationModel, type IIntegrationDocument } from "./integrations";
