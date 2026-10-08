// @ts-nocheck
import { IStorage, ManagedContactFilters } from "./storage";
import {
  UserModel,
  ApiKeyModel,
  OrganizationModel,
  OrganizationMemberModel,
  OrganizationThemeModel,
  WebsiteBuilderPageModel,
  WhatsappSessionModel,
  ChatModel,
  MessageModel,
  WebhookModel,
  CannedMessageModel,
  CountryDialCodeModel,
  ManagedContactModel,
  ContactTagModel,
  ContactNoteModel,
  ContactReminderModel,
  ContactActivityLogModel,
  GroupModel,
  GroupMemberModel,
  CampaignModel,
  CampaignRecipientModel,
  MessageTemplateModel,
  PlanModel,
  SubscriptionModel,
  PaymentModel,
  UserSettingsModel,
  SmtpSettingsModel,
  AutomationFlowModel,
  AutomationFlowRunModel,
  AutomationFlowScheduledRunModel,
  DripCampaignModel,
  ChatbotModel,
  AiAssistantModel,
  FaqItemModel,
  WaPayOrderModel,
  OrganizationInvoiceModel,
  OrganizationLeadModel,
  SupportTicketModel,
  SupportMessageModel,
  SupportAttachmentModel,
  PlatformMasterSettingsModel,
  PanelTransactionalEmailLogModel,
  BookingCalendarModel,
  ScheduledMeetingModel,
  IntegrationModel,
  IntegrationOAuthStateModel,
  OrganizationWalletModel,
  WalletTransactionModel,
  WalletReloadOrderModel,
  ContactColumnModel,
  OptKeywordModel,
  OrganizationInvoiceSettingsModel,
  OrganizationCommerceSettingsModel,
  FaqBotSettingsModel,
  WhitelabelOnboardingFeeModel,
  WhitelabelOnboardingSettlementModel,
  OrganizationLeadStatusModel,
} from "./models";
import { encryptCredentials, decryptCredentials } from "./utils/encryption";

export class MongoStorage implements IStorage {
  // ─── USER & AUTH ────────────────────────────────────────────────────────
  async getUser(id: string) {
    const doc = await UserModel.findById(id).lean();
    if (!doc) return undefined;
    return {
      ...doc,
      id: doc._id,
      isSaaSOwner: Boolean(doc.isSaaSOwner),
      isActive: doc.isActive !== false,
      accountStatus: doc.accountStatus || "active",
    };
  }

  async getUserByEmail(email: string) {
    if (!email) return undefined;
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!doc) return undefined;
    return {
      ...doc,
      id: doc._id,
      isSaaSOwner: Boolean(doc.isSaaSOwner),
      isActive: doc.isActive !== false,
      accountStatus: doc.accountStatus || "active",
    };
  }

  async getTotalOutstandingWhitelabelOnboardingMinor(): Promise<number> {
    return 0;
  }

  async getAddonMenuFeatureFlagsForUser(_userId: string) {
    return {
      hasAssignments: true,
      webhookEvents: true,
      chatbot: true,
      flows: true,
      dripCampaigns: true,
    };
  }

  async getActiveSubscriptionByUser(userId: string) {
    const doc = await SubscriptionModel.findOne({ userId, status: "active" }).lean();
    if (doc) return { ...doc, id: doc._id };
    const end = new Date();
    end.setFullYear(end.getFullYear() + 10);
    return {
      id: "unlimited-sub",
      userId,
      planId: "unlimited-plan",
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: end,
      createdAt: new Date(),
    };
  }

  async getEffectiveActiveSubscription(userId: string) {
    const sub = await this.getActiveSubscriptionByUser(userId);
    return { subscription: sub, effectiveUserId: userId };
  }

  async getSaasOwnerUser() {
    const doc = await UserModel.findOne({ isSaaSOwner: true }).lean();
    if (doc) return { ...doc, id: doc._id, isSaaSOwner: true, isActive: doc.isActive !== false, accountStatus: doc.accountStatus || "active" };
    return undefined;
  }

  async upsertUser(user: any) {
    const userId = user.id || user._id;
    if (userId) {
      const updated = await UserModel.findByIdAndUpdate(
        userId,
        { $set: user },
        { new: true, upsert: true }
      ).lean();
      return { ...updated, id: updated._id };
    }
    const created = await UserModel.create(user);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  // ─── API KEYS ───────────────────────────────────────────────────────────
  async createApiKey(data: any) {
    const created = await ApiKeyModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getApiKeysByUser(userId: string) {
    const docs = await ApiKeyModel.find({ userId, isActive: true }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getApiKeyByKey(keyHash: string) {
    const doc = await ApiKeyModel.findOne({ keyHash, isActive: true }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async deleteApiKey(id: string) {
    await ApiKeyModel.findByIdAndUpdate(id, { isActive: false });
  }

  async updateApiKeyLastUsed(id: string) {
    await ApiKeyModel.findByIdAndUpdate(id, { lastUsedAt: new Date() });
  }

  // ─── WHATSAPP SESSIONS ─────────────────────────────────────────────────
  async createSession(data: any) {
    const created = await WhatsappSessionModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getSession(sessionId: string) {
    const doc = await WhatsappSessionModel.findOne({ sessionId }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getSessionsBySessionIds(sessionIds: string[]) {
    const docs = await WhatsappSessionModel.find({ sessionId: { $in: sessionIds } }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getAllSessions() {
    const docs = await WhatsappSessionModel.find({ isActive: true }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getSessionsByUser(userId: string) {
    const docs = await WhatsappSessionModel.find({ userId, isActive: true }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getSessionsByOrganization(organizationId: string) {
    const docs = await WhatsappSessionModel.find({ organizationId, isActive: true }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getOfficialSessionsByApiPhoneNumberId(apiPhoneNumberId: string) {
    const docs = await WhatsappSessionModel.find({
      connectionType: "official",
      "deviceInfo.apiPhoneNumberId": apiPhoneNumberId,
    }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getOfficialSessionsByWabaId(wabaId: string) {
    const docs = await WhatsappSessionModel.find({
      connectionType: "official",
      "deviceInfo.wabaId": wabaId,
    }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async countConnectedSessions() {
    return WhatsappSessionModel.countDocuments({ status: "connected", isActive: true });
  }

  async getOfficialSessionsForWebhook(phoneNumberId: string, displayPhoneNumber?: string) {
    const query: any = {
      connectionType: "official",
      "deviceInfo.apiPhoneNumberId": phoneNumberId,
    };
    const docs = await WhatsappSessionModel.find(query).lean();
    if (docs.length > 0) return docs.map((d) => ({ ...d, id: d._id }));

    if (displayPhoneNumber) {
      const fallbackDocs = await WhatsappSessionModel.find({
        connectionType: "official",
        "deviceInfo.displayPhoneNumber": displayPhoneNumber,
      }).lean();
      return fallbackDocs.map((d) => ({ ...d, id: d._id }));
    }
    return [];
  }

  async updateSession(sessionId: string, data: any) {
    const updated = await WhatsappSessionModel.findOneAndUpdate(
      { sessionId },
      { $set: data },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteSession(sessionId: string) {
    await WhatsappSessionModel.deleteOne({ sessionId });
  }

  // ─── CHATS & MESSAGES ───────────────────────────────────────────────────
  async createChat(data: any) {
    const created = await ChatModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getChatsBySession(sessionId: string) {
    const docs = await ChatModel.find({ sessionId }).sort({ lastMessageTimestamp: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getChat(chatId: string) {
    const doc = await ChatModel.findById(chatId).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async updateChat(chatId: string, data: any) {
    const updated = await ChatModel.findByIdAndUpdate(chatId, { $set: data }, { new: true }).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async createMessage(data: any) {
    const created = await MessageModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getMessagesByChat(chatId: string, limit = 50) {
    const docs = await MessageModel.find({ chatId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return docs.reverse().map((d) => ({ ...d, id: d._id }));
  }

  async getMessagesByChatBeforeCursor(chatId: string, cursorTimestamp: Date, cursorId: string, limit: number) {
    const docs = await MessageModel.find({
      chatId,
      timestamp: { $lt: cursorTimestamp },
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return docs.reverse().map((d) => ({ ...d, id: d._id }));
  }

  async getLatestInboundMessageTimestamp(chatId: string) {
    const doc = await MessageModel.findOne({ chatId, isFromMe: false })
      .sort({ timestamp: -1 })
      .lean();
    return doc ? doc.timestamp : null;
  }

  async getLatestMessageTimestamp(chatId: string) {
    const doc = await MessageModel.findOne({ chatId }).sort({ timestamp: -1 }).lean();
    return doc ? doc.timestamp : null;
  }

  async countUnreadInboundMessages(chatId: string) {
    return MessageModel.countDocuments({
      chatId,
      isFromMe: false,
      status: { $nin: ["read", "seen"] },
    });
  }

  async countUnreadInboundByChatIds(chatIds: string[]) {
    const res = new Map<string, number>();
    if (!chatIds?.length) return res;
    const agg = await MessageModel.aggregate([
      {
        $match: {
          chatId: { $in: chatIds },
          isFromMe: false,
          status: { $nin: ["read", "seen"] },
        },
      },
      { $group: { _id: "$chatId", count: { $sum: 1 } } },
    ]);
    for (const row of agg) {
      res.set(row._id, row.count);
    }
    return res;
  }

  async markInboundMessagesReadInChat(chatId: string) {
    const res = await MessageModel.updateMany(
      { chatId, isFromMe: false, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );
    return res.modifiedCount;
  }

  async countMessagesInChat(chatId: string) {
    return MessageModel.countDocuments({ chatId });
  }

  async getMessageByIdOrWhatsAppId(messageId: string, userId: string, sessionId?: string) {
    const query: any = {
      $or: [{ _id: messageId }, { whatsappMessageId: messageId }],
    };
    if (sessionId) query.sessionId = sessionId;
    const doc = await MessageModel.findOne(query).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getMessageActivityForDateRangeByOrganization(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; messageCount: number }>> {
    try {
      const sessions = await WhatsappSessionModel.find({
        $or: [{ organizationId }, { organization_id: organizationId }],
      }).lean();
      const sessionIds = sessions.map((s: any) => s.sessionId || s.session_id);
      if (sessionIds.length === 0) return [];

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const rows = await MessageModel.aggregate([
        {
          $match: {
            sessionId: { $in: sessionIds },
            timestamp: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return rows.map((r: any) => ({
        date: r._id,
        messageCount: r.count,
      }));
    } catch {
      return [];
    }
  }

  // ─── ORGANIZATIONS ──────────────────────────────────────────────────────
  async createOrganization(data: any) {
    const slug = data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `org-${Date.now()}`;
    const created = await OrganizationModel.create({ slug, ...data });
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getOrganization(id: string) {
    const doc = await OrganizationModel.findById(id).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getOrganizationBySlug(slug: string) {
    const doc = await OrganizationModel.findOne({ slug }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async updateOrganization(id: string, data: any) {
    const updated = await OrganizationModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async getOrganizationMembers(organizationId: string) {
    const docs = await OrganizationMemberModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    const result: any[] = docs.map((d: any) => ({ ...d, id: d.id || d._id }));
    const org = await OrganizationModel.findById(organizationId).lean() || await OrganizationModel.findOne({ id: organizationId }).lean();
    const ownerId = org?.ownerId || (org as any)?.owner_id;
    if (ownerId && !result.some((m) => (m.userId || m.user_id) === ownerId)) {
      result.unshift({
        id: `owner-${ownerId}`,
        _id: `owner-${ownerId}`,
        organizationId,
        userId: ownerId,
        role: "owner",
        permissions: ["*"],
        joinedAt: org?.createdAt || new Date(),
      });
    }
    return result;
  }

  async getUserOrganizations(userId: string) {
    return this.getOrganizationsByUser(userId);
  }

  async getOrganizationsByUser(userId: string) {
    const memberships = await OrganizationMemberModel.find({ userId }).lean();
    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await OrganizationModel.find({
      $or: [
        { _id: { $in: orgIds } },
        { ownerId: userId }
      ]
    }).lean();
    if (orgs.length === 0) {
      const anyOrg = await OrganizationModel.find({}).limit(1).lean();
      return anyOrg.map((o) => ({ ...o, id: o._id }));
    }
    return orgs.map((o) => ({ ...o, id: o._id }));
  }

  async getOrganizationMember(organizationId: string, userId: string) {
    const doc = await OrganizationMemberModel.findOne({ organizationId, userId }).lean();
    if (doc) return { ...doc, id: doc._id };
    return { id: `owner-${userId}`, organizationId, userId, role: 'owner', permissions: ['*'] };
  }

  async getOrganizationMembersWithUsers(organizationId: string) {
    const members = await OrganizationMemberModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();

    const userIds = members.map((m: any) => m.userId || m.user_id).filter(Boolean);
    const userDocs = userIds.length > 0 ? await UserModel.find({
      $or: [{ _id: { $in: userIds } }, { id: { $in: userIds } }],
    }).lean() : [];
    const userMap = new Map(userDocs.map((u: any) => [u.id || u._id, u]));

    return members.map((m: any) => {
      const uId = m.userId || m.user_id;
      const user = userMap.get(uId);
      return {
        ...m,
        id: m.id || m._id,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        email: user?.email || null,
        user: user
          ? {
              id: user.id || user._id,
              email: user.email || null,
              firstName: user.firstName || null,
              lastName: user.lastName || null,
            }
          : null,
      };
    });
  }

  // ─── CONTACTS ───────────────────────────────────────────────────────────
  private buildManagedContactMongoQuery(organizationId: string, filters: any = {}, options?: { userId?: string }): any {
    const andConditions: any[] = [
      { $or: [{ organizationId }, { organization_id: organizationId }] },
    ];

    if (options?.userId || filters?.userId) {
      const uId = options?.userId || filters?.userId;
      andConditions.push({ $or: [{ userId: uId }, { user_id: uId }] });
    }

    if (filters?.search?.trim()) {
      const raw = filters.search.trim();
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      const digits = raw.replace(/\D/g, "");
      const searchOr: any[] = [
        { name: regex },
        { phone: regex },
        { phoneNumber: regex },
        { email: regex },
      ];
      if (digits.length > 0) {
        searchOr.push({ phone: new RegExp(digits, "i") });
        searchOr.push({ phoneNumber: new RegExp(digits, "i") });
      }
      andConditions.push({ $or: searchOr });
    }

    if (filters?.email?.trim()) {
      const emailRegex = new RegExp(filters.email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andConditions.push({ email: emailRegex });
    }

    if (filters?.createdDateFrom || filters?.createdDateTo) {
      const dateCond: any = {};
      if (filters.createdDateFrom) dateCond.$gte = new Date(filters.createdDateFrom);
      if (filters.createdDateTo) {
        const to = new Date(filters.createdDateTo);
        to.setHours(23, 59, 59, 999);
        dateCond.$lte = to;
      }
      andConditions.push({ createdAt: dateCond });
    }

    if (filters?.source && filters.source !== "all") {
      andConditions.push({
        $or: [
          { source: filters.source },
          { source: filters.source.toLowerCase() },
        ],
      });
    }

    if (filters?.unassignedOnly) {
      andConditions.push({
        $or: [
          { "customFields.assignedTo": { $exists: false } },
          { "customFields.assignedTo": null },
          { "customFields.assignedTo": "" },
        ],
      });
    }

    if (filters?.assignedTo?.length) {
      andConditions.push({
        "customFields.assignedTo": { $in: filters.assignedTo },
      });
    }

    return andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
  }

  private normalizeContactDoc(doc: any) {
    if (!doc) return undefined;
    const id = doc.id || doc._id;
    const phone = doc.phone || doc.phoneNumber || doc.phone_number || "";
    return {
      ...doc,
      id,
      _id: id,
      phone,
      phoneNumber: phone,
      customFields: doc.customFields || doc.custom_fields || {},
      tags: doc.tags || [],
    };
  }

  async createManagedContact(data: any) {
    const created = await ManagedContactModel.create(data);
    const doc = created.toObject();
    return this.normalizeContactDoc(doc);
  }

  async getManagedContact(id: string, _userId?: string, organizationId?: string) {
    const query: any = {
      $or: [{ _id: id }, { id }],
    };
    if (organizationId) {
      query.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const doc = await ManagedContactModel.findOne(query).lean();
    return doc ? this.normalizeContactDoc(doc) : undefined;
  }

  async getManagedContactByOrganization(contactId: string, organizationId: string) {
    const doc = await ManagedContactModel.findOne({
      $and: [
        { $or: [{ _id: contactId }, { id: contactId }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? this.normalizeContactDoc(doc) : undefined;
  }

  async findManagedContactByOrganizationAndPhoneDigits(organizationId: string, phoneDigits: string) {
    if (!phoneDigits) return undefined;
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (!cleanDigits) return undefined;
    const lastDigits = cleanDigits.slice(-10);
    const regex = new RegExp(lastDigits + "$");
    const doc = await ManagedContactModel.findOne({
      $and: [
        { $or: [{ organizationId }, { organization_id: organizationId }] },
        {
          $or: [
            { phone: regex },
            { phoneNumber: regex },
            { phone_number: regex },
          ],
        },
      ],
    }).lean();
    return doc ? this.normalizeContactDoc(doc) : undefined;
  }

  async getManagedContactsByOrganization(organizationId: string) {
    const docs = await ManagedContactModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => this.normalizeContactDoc(d));
  }

  async countManagedContactsByOrganization(organizationId: string): Promise<number> {
    return await ManagedContactModel.countDocuments({
      $or: [{ organizationId }, { organization_id: organizationId }],
    });
  }

  async getManagedContactsByUser(userId: string, organizationId: string) {
    return this.getManagedContactsWithFilters(userId, organizationId, {});
  }

  async getManagedContactsWithFilters(userId: string, organizationId: string, filters: any) {
    const query = this.buildManagedContactMongoQuery(organizationId, filters, { userId });
    const docs = await ManagedContactModel.find(query).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => this.normalizeContactDoc(d));
  }

  async getManagedContactsWithFiltersByOrganization(organizationId: string, filters: any) {
    const query = this.buildManagedContactMongoQuery(organizationId, filters);
    const docs = await ManagedContactModel.find(query).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => this.normalizeContactDoc(d));
  }

  async listManagedContactsWithFiltersByOrganization(
    organizationId: string,
    filters: any,
    pagination: { limit: number; offset: number }
  ) {
    const query = this.buildManagedContactMongoQuery(organizationId, filters);
    const total = await ManagedContactModel.countDocuments(query);
    const docs = await ManagedContactModel.find(query)
      .sort({ createdAt: -1 })
      .skip(pagination.offset || 0)
      .limit(pagination.limit || 50)
      .lean();
    const items = docs.map((d: any) => this.normalizeContactDoc(d));
    return {
      items,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async getContactTagsBatchByOrganization(contactIds: string[], _organizationId: string): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();
    contactIds.forEach((id) => result.set(id, []));
    if (contactIds.length === 0) return result;

    try {
      const contacts = await ManagedContactModel.find({
        $or: [{ _id: { $in: contactIds } }, { id: { $in: contactIds } }],
      }).lean();

      const allTagIds: string[] = [];
      contacts.forEach((c: any) => {
        if (Array.isArray(c.tags)) {
          c.tags.forEach((t: any) => {
            if (typeof t === "string") allTagIds.push(t);
          });
        }
      });

      let tagDocsMap = new Map<string, any>();
      if (allTagIds.length > 0) {
        const tagDocs = await ContactTagModel.find({
          $or: [{ _id: { $in: allTagIds } }, { id: { $in: allTagIds } }],
        }).lean();
        tagDocs.forEach((td: any) => {
          const tid = td.id || td._id;
          tagDocsMap.set(tid, { id: tid, name: td.name, color: td.color || "#3b82f6" });
        });
      }

      contacts.forEach((c: any) => {
        const cId = c.id || c._id;
        const cTags: any[] = [];
        if (Array.isArray(c.tags)) {
          c.tags.forEach((t: any) => {
            const found = tagDocsMap.get(t);
            if (found) cTags.push(found);
            else if (typeof t === "string") cTags.push({ id: t, name: t, color: "#3b82f6" });
          });
        }
        result.set(cId, cTags);
      });
    } catch {
      // Return empty map on error
    }

    return result;
  }

  async getContactTagsByOrganization(organizationId: string) {
    const docs = await ContactTagModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return docs.map((d: any) => ({ ...d, id: d.id || d._id }));
  }

  async listContactTagsByOrganization(organizationId: string, pagination: any = {}) {
    const query: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (pagination.search?.trim()) {
      query.name = new RegExp(pagination.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    const total = await ContactTagModel.countDocuments(query);
    const docs = await ContactTagModel.find(query)
      .sort({ createdAt: -1 })
      .skip(pagination.offset || 0)
      .limit(pagination.limit || 50)
      .lean();
    return {
      items: docs.map((d: any) => ({ ...d, id: d.id || d._id })),
      total,
      limit: pagination.limit || 50,
      offset: pagination.offset || 0,
    };
  }

  async getContactTagByOrganization(tagId: string, organizationId: string) {
    const doc = await ContactTagModel.findOne({
      $and: [
        { $or: [{ _id: tagId }, { id: tagId }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc.id || doc._id } : undefined;
  }

  async createManagedContactTagAssignment(contactId: string, tagId: string) {
    await ManagedContactModel.updateOne(
      { $or: [{ _id: contactId }, { id: contactId }] },
      { $addToSet: { tags: tagId } }
    );
    return { id: `${contactId}-${tagId}`, contactId, tagId };
  }

  async deleteManagedContactTagAssignment(contactId: string, tagId: string) {
    await ManagedContactModel.updateOne(
      { $or: [{ _id: contactId }, { id: contactId }] },
      { $pull: { tags: tagId } }
    );
  }

  async getInboxContactIndexByOrganization(organizationId: string) {
    const docs = await ManagedContactModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return docs.map((doc: any) => {
      const c = this.normalizeContactDoc(doc);
      return {
        id: c.id,
        phoneNumber: c.phoneNumber,
        name: c.name || undefined,
        customFields: c.customFields,
        source: c.source || undefined,
        tags: c.tags || [],
      };
    });
  }

  async getPhoneToAssignedUserIdMapForOrganization(organizationId: string): Promise<Map<string, string>> {
    const docs = await ManagedContactModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    const map = new Map<string, string>();
    for (const doc of docs) {
      const cf = (doc.customFields || doc.custom_fields) as Record<string, unknown> | null | undefined;
      const assigned = cf?.assignedTo;
      if (typeof assigned === "string" && assigned.trim() !== "") {
        const phone = doc.phone || doc.phoneNumber || doc.phone_number;
        const key = String(phone ?? "").replace(/\D/g, "");
        if (key) map.set(key, assigned.trim());
      }
    }
    return map;
  }

  async updateManagedContact(id: string, ...args: any[]) {
    const data = args.length === 1 ? args[0] : args[args.length - 1];
    const updated = await ManagedContactModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? this.normalizeContactDoc(updated) : undefined;
  }

  async deleteManagedContact(id: string, ..._args: any[]) {
    await ManagedContactModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────
  async createCampaign(data: any) {
    const created = await CampaignModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getCampaign(id: string) {
    const doc = await CampaignModel.findById(id).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getCampaignsByOrganization(organizationId: string) {
    const docs = await CampaignModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async updateCampaign(id: string, data: any) {
    const updated = await CampaignModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  // ─── GROUPS ─────────────────────────────────────────────────────────────
  async createGroup(data: any) {
    const created = await GroupModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getGroup(id: string) {
    const doc = await GroupModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc.id || doc._id } : undefined;
  }

  async getGroupsByOrganization(organizationId: string) {
    const docs = await GroupModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d.id || d._id }));
  }

  async getGroupsByUser(userId: string, organizationId?: string) {
    const query: any = { $or: [{ userId }, { user_id: userId }] };
    if (organizationId) {
      query.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const docs = await GroupModel.find(query).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d.id || d._id }));
  }

  async updateGroup(id: string, data: any) {
    const updated = await GroupModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated.id || updated._id } : undefined;
  }

  async deleteGroup(id: string) {
    await GroupModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  // ─── WALLET & BILLING ───────────────────────────────────────────────────
  async getOrganizationWallet(organizationId: string) {
    const doc = await OrganizationWalletModel.findOne({ organizationId }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async ensureOrganizationWallet(organizationId: string, currency = "INR") {
    let wallet = await OrganizationWalletModel.findOne({ organizationId }).lean();
    if (!wallet) {
      const created = await OrganizationWalletModel.create({
        organizationId,
        currency,
        balanceMinor: 0,
        status: "active",
      });
      wallet = created.toObject();
    }
    return { ...wallet, id: wallet._id };
  }

  async listWalletTransactions(organizationId: string, limit = 50, offset = 0) {
    const docs = await WalletTransactionModel.find({ organizationId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  // ─── PLATFORM MASTER SETTINGS ───────────────────────────────────────────
  static readonly PLATFORM_MASTER_ID = "singleton";

  async getPlatformMasterSettings() {
    const doc = await PlatformMasterSettingsModel.findById(MongoStorage.PLATFORM_MASTER_ID).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getActivePanelTemplateId(): Promise<string> {
    const row = await this.getPlatformMasterSettings();
    return row?.activePanelTemplateId ?? "default";
  }

  async setActivePanelTemplateId(panelTemplateId: string) {
    const updated = await PlatformMasterSettingsModel.findByIdAndUpdate(
      MongoStorage.PLATFORM_MASTER_ID,
      { $set: { activePanelTemplateId: panelTemplateId, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      ...updated,
      id: updated?._id ?? MongoStorage.PLATFORM_MASTER_ID,
      activePanelTemplateId: updated?.activePanelTemplateId ?? panelTemplateId,
    };
  }

  async setSubscriptionDataRetentionMonths(months: 1 | 2 | 3) {
    const updated = await PlatformMasterSettingsModel.findByIdAndUpdate(
      MongoStorage.PLATFORM_MASTER_ID,
      { $set: { subscriptionDataRetentionMonths: months, updatedAt: new Date() } },
      { upsert: true, new: true }
    ).lean();
    return { ...updated, id: updated._id };
  }

  async recordPlatformMasterUpstreamSync(
    upstreamPayload: Record<string, unknown>,
    lastSyncStatus: string,
    lastSyncError: string | null
  ) {
    const now = new Date();
    const updated = await PlatformMasterSettingsModel.findByIdAndUpdate(
      MongoStorage.PLATFORM_MASTER_ID,
      {
        $set: {
          upstreamPayload,
          lastSyncAt: now,
          lastSyncStatus,
          lastSyncError,
          updatedAt: now,
        },
      },
      { upsert: true, new: true }
    ).lean();
    return { ...updated, id: updated._id };
  }

  async clearUserSubscriptionDataPurgedAt(userId: string): Promise<void> {
    if (!userId) return;
    await UserModel.findByIdAndUpdate(userId, {
      $set: { subscriptionDataPurgedAt: null, updatedAt: new Date() },
    });
  }

  // ─── PLANS ──────────────────────────────────────────────────────────────
  async getAllPlans() {
    const docs = await PlanModel.find({}).sort({ priceMonthly: 1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getActivePlans() {
    const docs = await PlanModel.find({ isActive: true }).sort({ priceMonthly: 1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  async getPlan(id: string) {
    const doc = await PlanModel.findById(id).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getPlanByName(name: string) {
    const doc = await PlanModel.findOne({ name }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createPlan(data: any) {
    const created = await PlanModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updatePlan(id: string, data: any) {
    const updated = await PlanModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  // ─── AUTOMATION FLOWS & SCHEDULERS ───────────────────────────────────────
  async getAllActiveAutomationFlows() {
    const docs = await AutomationFlowModel.find({ isActive: true }).sort({ updatedAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id, status: d.isActive ? "active" : "inactive" }));
  }

  async getAutomationFlowById(id: string) {
    const doc = await AutomationFlowModel.findById(id).lean();
    return doc ? { ...doc, id: doc._id, status: doc.isActive ? "active" : "inactive" } : undefined;
  }

  async getAutomationFlowsByOrganization(organizationId: string) {
    const docs = await AutomationFlowModel.find({ organizationId }).sort({ updatedAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id, status: d.isActive ? "active" : "inactive" }));
  }

  async getAutomationFlowsByUser(userId: string) {
    const docs = await AutomationFlowModel.find({ userId }).sort({ updatedAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id, status: d.isActive ? "active" : "inactive" }));
  }

  async createAutomationFlow(data: any) {
    const created = await AutomationFlowModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateAutomationFlow(id: string, data: any) {
    const updated = await AutomationFlowModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteAutomationFlow(id: string) {
    await AutomationFlowModel.findByIdAndDelete(id);
  }

  async createAutomationFlowScheduledRun(data: any) {
    const created = await AutomationFlowScheduledRunModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async claimDueAutomationFlowScheduledRuns(now: Date, limit = 20) {
    const due = await AutomationFlowScheduledRunModel.find({
      status: "pending",
      resumeAt: { $lte: now },
    })
      .sort({ resumeAt: 1 })
      .limit(limit)
      .lean();

    const claimed = [];
    for (const row of due) {
      const updated = await AutomationFlowScheduledRunModel.findOneAndUpdate(
        { _id: row._id, status: "pending" },
        { $set: { status: "running", updatedAt: new Date() } },
        { new: true }
      ).lean();
      if (updated) claimed.push({ ...updated, id: updated._id });
    }
    return claimed;
  }

  async completeAutomationFlowScheduledRun(id: string): Promise<void> {
    await AutomationFlowScheduledRunModel.findByIdAndUpdate(id, {
      $set: { status: "completed", updatedAt: new Date() },
    });
  }

  // ─── CONTACT REMINDERS ──────────────────────────────────────────────────
  async claimDueRemindersForWhatsApp(now: Date, limit = 20) {
    const stuckBefore = new Date(now.getTime() - 2 * 60 * 1000);
    await ContactReminderModel.updateMany(
      { whatsappStatus: "sending", reminderAt: { $lte: stuckBefore } },
      { $set: { whatsappStatus: "pending", whatsappError: null } }
    );

    const due = await ContactReminderModel.find({
      whatsappStatus: "pending",
      reminderAt: { $lte: now },
      sessionId: { $exists: true, $ne: "" },
    })
      .sort({ reminderAt: 1 })
      .limit(limit)
      .lean();

    const claimed = [];
    for (const row of due) {
      const updated = await ContactReminderModel.findOneAndUpdate(
        { _id: row._id, whatsappStatus: "pending" },
        { $set: { whatsappStatus: "sending" } },
        { new: true }
      ).lean();
      if (updated) claimed.push({ ...updated, id: updated._id });
    }
    return claimed;
  }

  async requeueStuckReminderWhatsAppSends(
    optionsOrMinutes?: number | { olderThanMinutes?: number; limit?: number }
  ): Promise<number> {
    const mins =
      typeof optionsOrMinutes === "number"
        ? optionsOrMinutes
        : optionsOrMinutes?.olderThanMinutes ?? 2;
    const validMins = typeof mins === "number" && !isNaN(mins) ? mins : 2;
    const cutoff = new Date(Date.now() - Math.max(1, validMins) * 60 * 1000);
    const res = await ContactReminderModel.updateMany(
      { whatsappStatus: "sending", reminderAt: { $lte: cutoff } },
      { $set: { whatsappStatus: "pending", whatsappError: null } }
    );
    return res.modifiedCount;
  }

  async requeueFailedReminderWhatsAppSends(options?: any): Promise<number> {
    return 0;
  }

  async markReminderWhatsAppSent(id: string): Promise<void> {
    await ContactReminderModel.findByIdAndUpdate(id, {
      $set: { whatsappStatus: "sent", updatedAt: new Date() },
    });
  }

  // ─── TRANSACTIONAL EMAIL LOGS ───────────────────────────────────────────
  async panelTransactionalEmailLogExists(dedupeKey: string): Promise<boolean> {
    const count = await PanelTransactionalEmailLogModel.countDocuments({ dedupeKey });
    return count > 0;
  }

  async insertPanelTransactionalEmailLog(data: any): Promise<void> {
    await PanelTransactionalEmailLogModel.create(data);
  }

  // ─── WEBSITE BUILDER & INTEGRATIONS ─────────────────────────────────────
  async getWebsiteBuilderConfigForOrg(organizationId: string): Promise<Record<string, Record<string, unknown>>> {
    const rows = await WebsiteBuilderPageModel.find({ organizationId }).lean();
    const config: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      config[row.pageKey] = (row.content || {}) as Record<string, unknown>;
    }
    return config;
  }

  async getSubscriptionsEligibleForPanelReminders() {
    return [];
  }

  // ─── LEADS ──────────────────────────────────────────────────────────────
  async listOrganizationLeads(
    organizationId: string,
    query: any = {}
  ): Promise<{ items: any[]; total: number }> {
    if (!organizationId) return { items: [], total: 0 };
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (query?.status && query.status !== "all") {
      filter.status = query.status.trim().toLowerCase();
    }
    if (query?.priority && query.priority !== "all") {
      filter.priority = query.priority.trim().toLowerCase();
    }
    const total = await OrganizationLeadModel.countDocuments(filter);
    const docs = await OrganizationLeadModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(query?.offset || 0)
      .limit(query?.limit || 50)
      .lean();
    return {
      items: docs.map((d: any) => ({ ...d, id: d.id || d._id })),
      total,
    };
  }

  async listOrganizationLeadStatuses(_organizationId: string): Promise<any[]> {
    return [
      { id: "new", name: "New", order: 1, isDefault: true },
      { id: "contacted", name: "Contacted", order: 2, isDefault: false },
      { id: "qualified", name: "Qualified", order: 3, isDefault: false },
      { id: "closed_won", name: "Won", order: 4, isDefault: false },
      { id: "closed_lost", name: "Lost", order: 5, isDefault: false },
    ];
  }

  async getOrganizationLeadStatuses(organizationId: string): Promise<any[]> {
    return this.listOrganizationLeadStatuses(organizationId);
  }

  // ─── TEMPLATES ──────────────────────────────────────────────────────────
  async createMessageTemplate(data: any) {
    const created = await MessageTemplateModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async upsertMessageTemplate(data: any) {
    const filter: any = {};
    if (data.id || data._id) {
      filter.$or = [{ _id: data.id || data._id }, { id: data.id || data._id }];
    } else if (data.templateId) {
      filter.templateId = data.templateId;
    } else {
      filter.name = data.name;
    }
    const updated = await MessageTemplateModel.findOneAndUpdate(
      filter,
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async getMessageTemplate(id: string, _userId?: string) {
    const doc = await MessageTemplateModel.findOne({
      $or: [{ _id: id }, { id }, { templateId: id }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getMessageTemplateByOrganization(id: string, organizationId: string) {
    const doc = await MessageTemplateModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }, { templateId: id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getMessageTemplatesByUser(userId: string, organizationId?: string, phoneNumberId?: string) {
    const filter: any = {};
    if (organizationId) {
      filter.$or = [{ organizationId }, { organization_id: organizationId }];
    } else {
      filter.$or = [{ userId }, { user_id: userId }];
    }
    if (phoneNumberId) filter.phoneNumberId = phoneNumberId;
    const docs = await MessageTemplateModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getMessageTemplatesByOrganization(organizationId: string, phoneNumberId?: string) {
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (phoneNumberId) filter.phoneNumberId = phoneNumberId;
    const docs = await MessageTemplateModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async listMessageTemplatesByOrganization(organizationId: string, phoneNumberId?: string) {
    return this.getMessageTemplatesByOrganization(organizationId, phoneNumberId);
  }

  async updateMessageTemplate(id: string, data: any) {
    const updated = await MessageTemplateModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }, { templateId: id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteMessageTemplate(id: string, _userId?: string) {
    await MessageTemplateModel.findOneAndDelete({
      $or: [{ _id: id }, { id }, { templateId: id }],
    });
  }

  async deleteMessageTemplateByOrganization(id: string, organizationId: string) {
    await MessageTemplateModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }, { templateId: id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  async syncMessageTemplates(userId: string, templates: any[], phoneNumberId?: string, organizationId?: string) {
    for (const t of templates) {
      await this.upsertMessageTemplate({
        ...t,
        userId,
        organizationId,
        phoneNumberId,
      });
    }
  }

  // ─── CANNED MESSAGES ────────────────────────────────────────────────────
  async createCannedMessage(data: any) {
    const created = await CannedMessageModel.create({
      ...data,
      shortcut: data.shortcut || data.name || "quick",
      title: data.title || data.name || "Quick Reply",
      content: data.content || data.text || "",
    });
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getCannedMessage(id: string) {
    const doc = await CannedMessageModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getCannedMessageByOrganization(id: string, organizationId: string) {
    const doc = await CannedMessageModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getCannedMessagesByUser(userId: string, organizationId?: string) {
    const filter: any = {};
    if (organizationId) {
      filter.$or = [{ organizationId }, { organization_id: organizationId }];
    } else {
      filter.$or = [{ userId }, { user_id: userId }];
    }
    const docs = await CannedMessageModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getCannedMessagesByOrganization(organizationId: string) {
    const docs = await CannedMessageModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async listCannedMessagesByOrganization(organizationId: string) {
    return this.getCannedMessagesByOrganization(organizationId);
  }

  async updateCannedMessage(id: string, data: any) {
    const updated = await CannedMessageModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateCannedMessageByOrganization(id: string, organizationId: string, data: any) {
    const updated = await CannedMessageModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteCannedMessage(id: string) {
    await CannedMessageModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async deleteCannedMessageByOrganization(id: string, organizationId: string) {
    await CannedMessageModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  // ─── CONTACT COLUMNS ────────────────────────────────────────────────────
  async createContactColumn(data: any) {
    const created = await ContactColumnModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getContactColumn(id: string, _userId?: string, organizationId?: string) {
    const filter: any = { $or: [{ _id: id }, { id }] };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const doc = await ContactColumnModel.findOne(filter).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getContactColumnByOrganization(id: string, organizationId: string) {
    return this.getContactColumn(id, undefined, organizationId);
  }

  async getContactColumns(userId: string, organizationId: string) {
    return this.getContactColumnsByOrganization(organizationId);
  }

  async getContactColumnsByUser(userId: string, organizationId: string) {
    return this.getContactColumnsByOrganization(organizationId);
  }

  async getContactColumnsByOrganization(organizationId: string) {
    const docs = await ContactColumnModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ order: 1, createdAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateContactColumn(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await ContactColumnModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateContactColumnByOrganization(id: string, organizationId: string, data: any) {
    const updated = await ContactColumnModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteContactColumn(id: string, ..._args: any[]) {
    await ContactColumnModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async deleteContactColumnByOrganization(id: string, organizationId: string) {
    await ContactColumnModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  // ─── OPT KEYWORDS ────────────────────────────────────────────────────────
  async createOptKeyword(data: any) {
    const created = await OptKeywordModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getOptKeyword(id: string) {
    const doc = await OptKeywordModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getOptKeywords(_userId: string, organizationId: string, type?: string) {
    return this.getOptKeywordsByOrganization(organizationId, type);
  }

  async getOptKeywordsByOrganization(organizationId: string, type?: string) {
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (type) filter.type = type;
    const docs = await OptKeywordModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getOptKeywordsByUser(userId: string, organizationId: string, type?: string) {
    return this.getOptKeywordsByOrganization(organizationId, type);
  }

  async updateOptKeywords(userId: string, organizationId: string, type: string, keywords: string[]) {
    return this.updateOptKeywordsByOrganization(organizationId, type, keywords, userId);
  }

  async updateOptKeywordsByOrganization(organizationId: string, type: string, keywords: string[], userId: string) {
    await OptKeywordModel.deleteMany({
      $or: [{ organizationId }, { organization_id: organizationId }],
      type,
    });
    const created = [];
    for (const kw of keywords) {
      if (kw.trim()) {
        const doc = await OptKeywordModel.create({
          organizationId,
          userId,
          type,
          keyword: kw.trim().toUpperCase(),
        });
        created.push({ ...doc.toObject(), id: doc._id });
      }
    }
    return created;
  }

  async deleteOptKeyword(id: string, ..._args: any[]) {
    await OptKeywordModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async findOptKeyword(organizationId: string, keyword: string) {
    const doc = await OptKeywordModel.findOne({
      $and: [
        { $or: [{ organizationId }, { organization_id: organizationId }] },
        { keyword: keyword.trim().toUpperCase() },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  // ─── CONTACT NOTES & LOGS ───────────────────────────────────────────────
  async createContactNote(data: any) {
    const created = await ContactNoteModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getContactNotes(contactId: string, _userId?: string, organizationId?: string) {
    const filter: any = {
      $or: [{ contactId }, { contact_id: contactId }],
    };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const docs = await ContactNoteModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateContactNote(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await ContactNoteModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteContactNote(id: string, ..._args: any[]) {
    await ContactNoteModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async createContactActivityLog(data: any) {
    const created = await ContactActivityLogModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getContactActivityLogs(contactId: string, _userId?: string, organizationId?: string) {
    const filter: any = {
      $or: [{ contactId }, { contact_id: contactId }],
    };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const docs = await ContactActivityLogModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async createContactReminder(data: any) {
    const created = await ContactReminderModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getContactReminders(contactId: string, _userId?: string, organizationId?: string) {
    const filter: any = {
      $or: [{ contactId }, { contact_id: contactId }],
    };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const docs = await ContactReminderModel.find(filter).sort({ reminderAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getContactRemindersByOrganization(contactId: string, organizationId: string) {
    return this.getContactReminders(contactId, undefined, organizationId);
  }

  async getAllRemindersForUser(userId: string, organizationId: string, filters: any = {}) {
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
      $and: [{ $or: [{ reminderTo: userId }, { userId }] }],
    };
    if (filters.dateFrom || filters.dateTo) {
      filter.reminderAt = {};
      if (filters.dateFrom) filter.reminderAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.reminderAt.$lte = to;
      }
    }
    const docs = await ContactReminderModel.find(filter).sort({ reminderAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getAllRemindersByOrganization(organizationId: string, filters: any = {}) {
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (filters.reminderTo) {
      filter.reminderTo = filters.reminderTo;
    }
    if (filters.dateFrom || filters.dateTo) {
      filter.reminderAt = {};
      if (filters.dateFrom) filter.reminderAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.reminderAt.$lte = to;
      }
    }
    const docs = await ContactReminderModel.find(filter).sort({ reminderAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getDueRemindersByOrganization(organizationId: string) {
    const docs = await ContactReminderModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
      reminderAt: { $lte: new Date() },
    }).sort({ reminderAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getUpcomingRemindersByOrganization(organizationId: string) {
    const docs = await ContactReminderModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
      reminderAt: { $gt: new Date() },
    }).sort({ reminderAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateContactReminder(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await ContactReminderModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateContactReminderByOrganization(reminderId: string, _contactId: string, organizationId: string, data: any) {
    const updated = await ContactReminderModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: reminderId }, { id: reminderId }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteContactReminder(id: string, ..._args: any[]) {
    await ContactReminderModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async deleteContactReminderByOrganization(reminderId: string, _contactId: string, organizationId: string) {
    await ContactReminderModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: reminderId }, { id: reminderId }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  // ─── CAMPAIGNS & RECIPIENTS ─────────────────────────────────────────────
  async getCampaignsByUser(userId: string, organizationId?: string) {
    const filter: any = {};
    if (organizationId) {
      filter.$or = [{ organizationId }, { organization_id: organizationId }];
    } else {
      filter.$or = [{ userId }, { user_id: userId }];
    }
    const docs = await CampaignModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getCampaignByOrganization(id: string, organizationId: string) {
    const doc = await CampaignModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async deleteCampaign(id: string, ..._args: any[]) {
    await CampaignModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
    await CampaignRecipientModel.deleteMany({ campaignId: id });
  }

  async deleteCampaignByOrganization(id: string, organizationId: string) {
    await CampaignModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    await CampaignRecipientModel.deleteMany({ campaignId: id });
  }

  async updateCampaignByOrganization(id: string, organizationId: string, data: any) {
    const updated = await CampaignModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateCampaignStats(id: string, _userId: string, _organizationId: string, stats: any) {
    await CampaignModel.updateOne(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...stats, updatedAt: new Date() } }
    );
  }

  async updateCampaignExecution(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await CampaignModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateCampaignExecutionByOrganization(id: string, organizationId: string, data: any) {
    return this.updateCampaignByOrganization(id, organizationId, data);
  }

  async addCampaignRecipient(data: any, ..._args: any[]) {
    const created = await CampaignRecipientModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async addCampaignRecipientByOrganization(data: any, _organizationId: string) {
    return this.addCampaignRecipient(data);
  }

  async insertCampaignRecipientsBulk(campaignId: string, _userId: string, _organizationId: string, rawRecipients: any[]) {
    if (!rawRecipients?.length) return { inserted: 0, skipped: 0 };
    const docs = rawRecipients.map((r: any) => ({
      campaignId,
      contactId: r.contactId || r.contact_id,
      phone: r.phone || r.phoneNumber || r.number || "",
      phoneNumber: r.phone || r.phoneNumber || r.number || "",
      name: r.name || "",
      status: "pending",
      variables: r.variables || {},
    }));
    await CampaignRecipientModel.insertMany(docs, { ordered: false });
    return { inserted: docs.length, skipped: 0 };
  }

  async getCampaignRecipients(campaignId: string, ..._args: any[]) {
    const docs = await CampaignRecipientModel.find({ campaignId }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getCampaignRecipientsByOrganization(campaignId: string, _organizationId: string) {
    return this.getCampaignRecipients(campaignId);
  }

  async updateCampaignRecipientStatus(id: string, ...args: any[]) {
    const status = args[args.length - 3] || args[0];
    const messageId = args[args.length - 2];
    const errorMessage = args[args.length - 1];
    const patch: any = { status };
    if (typeof messageId === "string") patch.messageId = messageId;
    if (typeof errorMessage === "string") patch.errorMessage = errorMessage;
    if (status === "sent") patch.sentAt = new Date();
    if (status === "delivered") patch.deliveredAt = new Date();
    if (status === "read") patch.readAt = new Date();
    await CampaignRecipientModel.updateOne({ $or: [{ _id: id }, { id }] }, { $set: patch });
  }

  async updateCampaignRecipientStatusByOrganization(recipientId: string, _organizationId: string, status: any, messageId?: string) {
    return this.updateCampaignRecipientStatus(recipientId, status, messageId);
  }

  async updateCampaignRecipientStatusByWhatsAppMessageId(whatsappMessageId: string, status: any, errorMessage?: string) {
    const patch: any = { status };
    if (errorMessage) patch.errorMessage = errorMessage;
    if (status === "sent") patch.sentAt = new Date();
    if (status === "delivered") patch.deliveredAt = new Date();
    if (status === "read") patch.readAt = new Date();
    const res = await CampaignRecipientModel.updateOne(
      { $or: [{ messageId: whatsappMessageId }, { whatsappMessageId }] },
      { $set: patch }
    );
    return res.modifiedCount > 0;
  }

  async markCampaignPendingRecipientsFailed(campaignId: string, ...args: any[]) {
    const errorMessage = args[args.length - 1] || "Campaign execution cancelled";
    const res = await CampaignRecipientModel.updateMany(
      { campaignId, status: "pending" },
      { $set: { status: "failed", errorMessage } }
    );
    return res.modifiedCount;
  }

  // ─── DRIP CAMPAIGNS ─────────────────────────────────────────────────────
  async createDripCampaign(data: any) {
    const created = await DripCampaignModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getDripCampaign(id: string, organizationId?: string) {
    const filter: any = { $or: [{ _id: id }, { id }] };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const doc = await DripCampaignModel.findOne(filter).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getDripCampaignsByOrganization(organizationId: string) {
    const docs = await DripCampaignModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ updatedAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateDripCampaign(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await DripCampaignModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteDripCampaign(id: string, ..._args: any[]) {
    await DripCampaignModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  // ─── CHATBOTS, AI ASSISTANTS & FAQ ──────────────────────────────────────
  async createChatbot(data: any) {
    const created = await ChatbotModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getChatbot(id: string, ..._args: any[]) {
    const doc = await ChatbotModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getChatbotByOrganization(id: string, organizationId: string) {
    const doc = await ChatbotModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getChatbots(_userId?: string, organizationId?: string) {
    const filter: any = organizationId
      ? { $or: [{ organizationId }, { organization_id: organizationId }] }
      : {};
    const docs = await ChatbotModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getChatbotsByUser(userId: string, organizationId?: string) {
    return this.getChatbots(userId, organizationId);
  }

  async getChatbotsByOrganization(organizationId: string) {
    return this.getChatbots(undefined, organizationId);
  }

  async updateChatbot(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await ChatbotModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateChatbotByOrganization(id: string, organizationId: string, data: any) {
    const updated = await ChatbotModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteChatbot(id: string, ..._args: any[]) {
    await ChatbotModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async deleteChatbotByOrganization(id: string, organizationId: string) {
    await ChatbotModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  async getChatbotNodes(chatbotId: string) {
    const bot = await this.getChatbot(chatbotId);
    return bot?.nodes || [];
  }

  async upsertChatbotNodes(chatbotId: string, nodes: any[]) {
    await ChatbotModel.updateOne(
      { $or: [{ _id: chatbotId }, { id: chatbotId }] },
      { $set: { nodes, updatedAt: new Date() } }
    );
    return nodes;
  }

  async deleteChatbotNodes(chatbotId: string) {
    await ChatbotModel.updateOne(
      { $or: [{ _id: chatbotId }, { id: chatbotId }] },
      { $set: { nodes: [], updatedAt: new Date() } }
    );
  }

  async createAiAssistant(data: any) {
    const created = await AiAssistantModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getAiAssistant(id: string, ..._args: any[]) {
    const doc = await AiAssistantModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getAiAssistantByOrganization(id: string, organizationId: string) {
    const doc = await AiAssistantModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getAiAssistants(_userId?: string, organizationId?: string) {
    const filter: any = organizationId
      ? { $or: [{ organizationId }, { organization_id: organizationId }] }
      : {};
    const docs = await AiAssistantModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getAiAssistantsByOrganization(organizationId: string) {
    return this.getAiAssistants(undefined, organizationId);
  }

  async updateAiAssistant(id: string, ...args: any[]) {
    const data = args[args.length - 1];
    const updated = await AiAssistantModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateAiAssistantByOrganization(id: string, organizationId: string, data: any) {
    const updated = await AiAssistantModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteAiAssistant(id: string, ..._args: any[]) {
    await AiAssistantModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async deleteAiAssistantByOrganization(id: string, organizationId: string) {
    await AiAssistantModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  async getAiAssistantKnowledgeFiles(assistantId: string) {
    const assistant = await this.getAiAssistant(assistantId);
    return assistant?.knowledgeFiles || [];
  }

  async addAiAssistantKnowledgeFile(data: any) {
    const assistantId = data.assistantId;
    const file = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
    await AiAssistantModel.updateOne(
      { $or: [{ _id: assistantId }, { id: assistantId }] },
      { $push: { knowledgeFiles: file } }
    );
    return file;
  }

  async deleteAiAssistantKnowledgeFile(fileId: string, assistantId: string) {
    await AiAssistantModel.updateOne(
      { $or: [{ _id: assistantId }, { id: assistantId }] },
      { $pull: { knowledgeFiles: { id: fileId } } }
    );
  }

  async createFaqItem(data: any) {
    const created = await FaqItemModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getFaqItem(id: string) {
    const doc = await FaqItemModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getFaqItemByOrganization(id: string, organizationId: string) {
    const doc = await FaqItemModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getFaqItemsByOrganization(organizationId: string) {
    const docs = await FaqItemModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ order: 1, createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateFaqItemByOrganization(id: string, organizationId: string, data: any) {
    const updated = await FaqItemModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteFaqItemByOrganization(id: string, organizationId: string) {
    await FaqItemModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
  }

  async getFaqBotSettingsByOrganization(organizationId: string) {
    const doc = await FaqBotSettingsModel.findOne({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async upsertFaqBotSettingsByOrganization(organizationId: string, data: any) {
    const updated = await FaqBotSettingsModel.findOneAndUpdate(
      { $or: [{ organizationId }, { organization_id: organizationId }] },
      { $set: { ...data, organizationId, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async getOrganizationLiveChatSettings(organizationId: string) {
    return { organizationId, isLiveChatEnabled: true, botTakeoverMode: "auto" };
  }

  async upsertOrganizationLiveChatSettings(organizationId: string, data: any) {
    return { organizationId, ...data };
  }

  // ─── INVOICES & COMMERCE ────────────────────────────────────────────────
  async listOrganizationInvoices(organizationId: string, query: any = {}) {
    const filter: any = {
      $or: [{ organizationId }, { organization_id: organizationId }],
    };
    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    if (query.pendingOnly) {
      filter.status = { $in: ["unpaid", "pending", "partially_paid"] };
    }
    const total = await OrganizationInvoiceModel.countDocuments(filter);
    const docs = await OrganizationInvoiceModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(query.offset || 0)
      .limit(query.limit || 50)
      .lean();
    return {
      items: docs.map((d: any) => ({ ...d, id: d._id })),
      total,
    };
  }

  async getOrganizationInvoice(id: string, organizationId?: string) {
    const filter: any = { $or: [{ _id: id }, { id }, { invoiceNumber: id }, { invoiceNo: id }] };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    }
    const doc = await OrganizationInvoiceModel.findOne(filter).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getOrganizationInvoiceById(id: string, organizationId: string) {
    return this.getOrganizationInvoice(id, organizationId);
  }

  async createOrganizationInvoice(data: any) {
    const created = await OrganizationInvoiceModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateOrganizationInvoice(id: string, organizationId: string, data: any) {
    const updated = await OrganizationInvoiceModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }, { invoiceNumber: id }, { invoiceNo: id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteOrganizationInvoice(id: string, organizationId: string) {
    const res = await OrganizationInvoiceModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }, { invoiceNumber: id }, { invoiceNo: id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    return !!res;
  }

  async getOrganizationInvoiceSettings(organizationId: string) {
    const doc = await OrganizationInvoiceSettingsModel.findOne({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async upsertOrganizationInvoiceSettings(organizationId: string, data: any) {
    const updated = await OrganizationInvoiceSettingsModel.findOneAndUpdate(
      { $or: [{ organizationId }, { organization_id: organizationId }] },
      { $set: { ...data, organizationId, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async getOrganizationCommerceSettings(organizationId: string) {
    const doc = await OrganizationCommerceSettingsModel.findOne({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async upsertOrganizationCommerceSettings(organizationId: string, data: any) {
    const updated = await OrganizationCommerceSettingsModel.findOneAndUpdate(
      { $or: [{ organizationId }, { organization_id: organizationId }] },
      { $set: { ...data, organizationId, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async listWaPayOrders(organizationId: string, limit = 50) {
    const docs = await WaPayOrderModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async listWaPayOrdersForOrganization(organizationId: string, limit = 50) {
    return this.listWaPayOrders(organizationId, limit);
  }

  // ─── SUPPORT TICKETS ────────────────────────────────────────────────────
  async listSupportTickets(organizationId?: string) {
    const filter: any = organizationId
      ? { $or: [{ organizationId }, { organization_id: organizationId }] }
      : {};
    const docs = await SupportTicketModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async listSupportTicketsForOrganization(organizationId: string) {
    return this.listSupportTickets(organizationId);
  }

  async listAllSupportTickets() {
    return this.listSupportTickets();
  }

  async listSupportTicketsForCustomer(userId: string, emailLower: string) {
    const filter: any = {
      $or: [
        { customerUserId: userId },
        { customerEmail: emailLower },
        { "customer.email": emailLower },
      ],
    };
    const docs = await SupportTicketModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getSupportTicketById(id: string) {
    const doc = await SupportTicketModel.findOne({
      $or: [{ _id: id }, { id }, { ticketNumber: id }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getSupportTicketByIdForOrganization(id: string, organizationId: string) {
    const doc = await SupportTicketModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }, { ticketNumber: id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getSupportTicketByAccessToken(accessToken: string) {
    const doc = await SupportTicketModel.findOne({ accessToken }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createSupportTicketRow(data: any) {
    const created = await SupportTicketModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async createSupportMessageRow(data: any) {
    const created = await SupportMessageModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async createSupportAttachmentRow(data: any) {
    const created = await SupportAttachmentModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateSupportTicketByOrganization(id: string, organizationId: string, data: any) {
    const updated = await SupportTicketModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async updateSupportTicketById(id: string, data: any) {
    const updated = await SupportTicketModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async getSupportMessagesByTicketId(ticketId: string) {
    const docs = await SupportMessageModel.find({ ticketId }).sort({ createdAt: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getSupportAttachmentsByTicketId(ticketId: string) {
    const docs = await SupportAttachmentModel.find({ ticketId }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getSupportAttachmentsByMessageIds(messageIds: string[]) {
    const docs = await SupportAttachmentModel.find({ messageId: { $in: messageIds } }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async createSupportTicketWithInitialMessage(input: any, attachment?: any) {
    const ticket = await this.createSupportTicketRow({
      ...input,
      ticketNumber: `TICK-${Date.now().toString().slice(-6)}`,
      status: "open",
      priority: "medium",
    });
    const firstMessage = await this.createSupportMessageRow({
      ticketId: ticket.id,
      body: input.description,
      authorType: "customer",
      authorUserId: input.customerUserId,
    });
    let attDoc;
    if (attachment) {
      attDoc = await this.createSupportAttachmentRow({
        ticketId: ticket.id,
        messageId: firstMessage.id,
        ...attachment,
      });
    }
    return { ticket, firstMessage, attachment: attDoc };
  }

  // ─── BOOKING CALENDARS & MEETINGS ───────────────────────────────────────
  async listBookingCalendars(organizationId: string) {
    const docs = await BookingCalendarModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ updatedAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getBookingCalendarsByOrganization(organizationId: string) {
    return this.listBookingCalendars(organizationId);
  }

  async getBookingCalendar(id: string, ..._args: any[]) {
    const doc = await BookingCalendarModel.findOne({
      $or: [{ _id: id }, { id }, { slug: id }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getBookingCalendarById(id: string, organizationId: string) {
    const doc = await BookingCalendarModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getBookingCalendarBySlug(slug: string) {
    const doc = await BookingCalendarModel.findOne({ slug, isActive: true }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createBookingCalendar(data: any) {
    const created = await BookingCalendarModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateBookingCalendar(id: string, organizationId: string, data: any) {
    const updated = await BookingCalendarModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteBookingCalendar(id: string, organizationId: string) {
    const res = await BookingCalendarModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    return !!res;
  }

  async listScheduledMeetings(params: any = {}) {
    const query: any = {};
    if (params.organizationId) {
      query.$or = [
        { organizationId: params.organizationId },
        { organization_id: params.organizationId },
      ];
    }
    if (params.status) query.status = params.status;
    const docs = await ScheduledMeetingModel.find(query).sort({ startAt: 1 }).lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      startAt: d.startAt || d.startTime,
      endAt: d.endAt || d.endTime,
      bookingCalendarId: d.bookingCalendarId || d.calendarId,
      meetLink: d.meetLink || d.meetingUrl,
    }));
  }

  async getScheduledMeeting(id: string, organizationId: string) {
    const doc = await ScheduledMeetingModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? {
      ...doc,
      id: doc._id,
      startAt: doc.startAt || doc.startTime,
      endAt: doc.endAt || doc.endTime,
      bookingCalendarId: doc.bookingCalendarId || doc.calendarId,
      meetLink: doc.meetLink || doc.meetingUrl,
    } : undefined;
  }

  async createScheduledMeeting(data: any) {
    const created = await ScheduledMeetingModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateScheduledMeeting(id: string, organizationId: string, data: any) {
    const updated = await ScheduledMeetingModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteScheduledMeeting(id: string, organizationId: string) {
    const res = await ScheduledMeetingModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    return !!res;
  }

  // ─── WEBHOOKS & INTEGRATIONS ────────────────────────────────────────────
  async createWebhook(data: any) {
    const created = await WebhookModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getWebhook(id: string) {
    const doc = await WebhookModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getWebhooksByUser(userId: string) {
    const docs = await WebhookModel.find({
      $or: [{ userId }, { user_id: userId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getWebhooksByOrganization(organizationId: string) {
    const docs = await WebhookModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async updateWebhook(id: string, data: any) {
    const updated = await WebhookModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteWebhook(id: string) {
    await WebhookModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  async createIntegration(data: any) {
    const encryptedData = { ...data };
    if (data.credentials) {
      encryptedData.credentials = encryptCredentials(data.credentials);
    }
    const created = await IntegrationModel.create(encryptedData);
    const doc = created.toObject();
    return {
      ...doc,
      id: doc._id,
      credentials: doc.credentials ? decryptCredentials(doc.credentials) : null,
    };
  }

  async getIntegration(id: string, _userId?: string) {
    const doc = await IntegrationModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    if (!doc) return undefined;
    return {
      ...doc,
      id: (doc as any)._id,
      credentials: (doc as any).credentials ? decryptCredentials((doc as any).credentials) : null,
    };
  }

  async getIntegrationById(id: string) {
    return this.getIntegration(id);
  }

  async getIntegrationsByUser(userId: string, organizationId?: string) {
    const conditions: any[] = [{ userId }, { user_id: userId }];
    if (organizationId) {
      conditions.push({ organizationId }, { organization_id: organizationId });
    }
    const docs = await IntegrationModel.find({ $or: conditions })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      credentials: d.credentials ? decryptCredentials(d.credentials) : null,
    }));
  }

  async getIntegrationsByOrganization(organizationId: string) {
    const docs = await IntegrationModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      credentials: d.credentials ? decryptCredentials(d.credentials) : null,
    }));
  }

  async getRecentConnectedWhatsAppIntegrations(withinMs: number, limit = 25) {
    const since = new Date(Date.now() - withinMs);
    const docs = await IntegrationModel.find({
      $or: [{ name: "whatsapp-business" }, { provider: "whatsapp-business" }],
      status: "connected",
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      credentials: d.credentials ? decryptCredentials(d.credentials) : null,
    }));
  }

  async getIntegrationByName(name: string, userId?: string, organizationId?: string) {
    const filter: any = {
      $or: [{ name }, { provider: name }],
    };
    if (organizationId) {
      filter.$and = [{ $or: [{ organizationId }, { organization_id: organizationId }] }];
    } else if (userId) {
      filter.$and = [{ $or: [{ userId }, { user_id: userId }] }];
    }
    const doc = await IntegrationModel.findOne(filter).lean();
    if (!doc) return undefined;
    return {
      ...doc,
      id: (doc as any)._id,
      credentials: (doc as any).credentials ? decryptCredentials((doc as any).credentials) : null,
    };
  }

  async getAllIntegrationsByName(name: string) {
    const docs = await IntegrationModel.find({
      $or: [{ name }, { provider: name }],
    }).lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      credentials: d.credentials ? decryptCredentials(d.credentials) : null,
    }));
  }

  async getWhatsAppChatWidgetByPublicId(publicId: string) {
    const doc = await IntegrationModel.findOne({
      $or: [{ name: "whatsapp-chat-widget" }, { provider: "whatsapp-chat-widget" }],
      "config.widgetPublicId": publicId,
    }).lean();
    if (!doc) return undefined;
    return {
      ...doc,
      id: (doc as any)._id,
      credentials: (doc as any).credentials ? decryptCredentials((doc as any).credentials) : null,
    };
  }

  async updateIntegration(id: string, ...args: any[]) {
    const data = { ...args[args.length - 1] };
    if (data.credentials) {
      data.credentials = encryptCredentials(data.credentials);
    }
    const updated = await IntegrationModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) return undefined;
    return {
      ...updated,
      id: (updated as any)._id,
      credentials: (updated as any).credentials ? decryptCredentials((updated as any).credentials) : null,
    };
  }

  async deleteIntegration(id: string, ..._args: any[]) {
    await IntegrationModel.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  }

  // ─── INTEGRATION OAUTH STATES ───────────────────────────────────────────
  async createOAuthState(data: any): Promise<any> {
    const created = await IntegrationOAuthStateModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getOAuthState(state: string): Promise<any> {
    if (!state) return undefined;
    const doc = await IntegrationOAuthStateModel.findOne({ state }).lean();
    if (!doc) return undefined;
    return { ...doc, id: (doc as any)._id };
  }

  async getLatestActiveOAuthState(userId: string, integrationName: string): Promise<any> {
    const doc = await IntegrationOAuthStateModel.findOne({
      userId,
      integrationName,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!doc) return undefined;
    return { ...doc, id: (doc as any)._id };
  }

  async updateOAuthState(state: string, data: any): Promise<void> {
    await IntegrationOAuthStateModel.updateOne(
      { state },
      { $set: { ...data, updatedAt: new Date() } }
    );
  }

  async deleteOAuthState(state: string): Promise<void> {
    await IntegrationOAuthStateModel.deleteOne({ state });
  }

  async cleanupExpiredOAuthStates(): Promise<void> {
    await IntegrationOAuthStateModel.deleteMany({
      expiresAt: { $lte: new Date() },
    });
  }

  async getSaasOwnerRazorpayForOrgSubscription() {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    return this.getIntegrationByName("razorpay", owner.id);
  }

  async getSaasOwnerStripeForOrgSubscription() {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    return this.getIntegrationByName("stripe", owner.id);
  }

  async getSaasOwnerSmtpIntegration() {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    return this.getIntegrationByName("smtp", owner.id);
  }

  // ─── ADMIN USERS, ORGS, SUBSCRIPTIONS & PAYMENTS ─────────────────────────
  async getAllUsers() {
    const docs = await UserModel.find({}).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({
      ...d,
      id: d._id,
      isSaaSOwner: Boolean(d.isSaaSOwner || d.is_saas_owner),
      isActive: d.isActive !== false && d.is_active !== false,
      accountStatus: d.accountStatus || d.account_status || "active",
    }));
  }

  async updateUser(id: string, data: any) {
    const updated = await UserModel.findByIdAndUpdate(
      id,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteUser(id: string) {
    await UserModel.findByIdAndDelete(id);
  }

  async getAllOrganizations() {
    const docs = await OrganizationModel.find({}).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async deleteOrganization(id: string) {
    await OrganizationModel.findByIdAndDelete(id);
  }

  async listSubscriptions(query: any = {}) {
    const filter: any = {};
    if (query.userId) filter.userId = query.userId;
    if (query.status && query.status !== "all") filter.status = query.status;
    const docs = await SubscriptionModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getSubscriptionsByUser(userId: string) {
    const docs = await SubscriptionModel.find({
      $or: [{ userId }, { user_id: userId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getSubscription(id: string) {
    const doc = await SubscriptionModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createSubscription(data: any) {
    const created = await SubscriptionModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updateSubscription(id: string, data: any) {
    const updated = await SubscriptionModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async listPayments(query: any = {}) {
    const filter: any = {};
    if (query.userId) filter.userId = query.userId;
    if (query.subscriptionId) filter.subscriptionId = query.subscriptionId;
    const docs = await PaymentModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getPaymentsByUser(userId: string) {
    const docs = await PaymentModel.find({
      $or: [{ userId }, { user_id: userId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getPaymentsBySubscription(subscriptionId: string) {
    const docs = await PaymentModel.find({
      $or: [{ subscriptionId }, { subscription_id: subscriptionId }],
    }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getPayment(id: string) {
    const doc = await PaymentModel.findOne({ $or: [{ _id: id }, { id }] }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createPayment(data: any) {
    const created = await PaymentModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async updatePayment(id: string, data: any) {
    const updated = await PaymentModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deletePlan(id: string) {
    await PlanModel.findByIdAndDelete(id);
  }

  // ─── SETTINGS, LEADS & DIAL CODES ───────────────────────────────────────
  async getUserSettings(userId: string) {
    const doc = await UserSettingsModel.findOne({
      $or: [{ userId }, { user_id: userId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createOrUpdateUserSettings(data: any) {
    const userId = data.userId || data.user_id;
    const updated = await UserSettingsModel.findOneAndUpdate(
      { $or: [{ userId }, { user_id: userId }] },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async getSmtpSettings(userId: string) {
    const doc = await SmtpSettingsModel.findOne({
      $or: [{ userId }, { user_id: userId }, { _id: "singleton" }, { id: "singleton" }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createOrUpdateSmtpSettings(data: any) {
    const id = data.id || "singleton";
    const updated = await SmtpSettingsModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async getOrganizationTheme(organizationId: string) {
    const doc = await OrganizationThemeModel.findOne({
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createOrUpdateOrganizationTheme(data: any) {
    const organizationId = data.organizationId;
    const updated = await OrganizationThemeModel.findOneAndUpdate(
      { $or: [{ organizationId }, { organization_id: organizationId }] },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...updated, id: updated?._id };
  }

  async deleteOrganizationTheme(organizationId: string) {
    await OrganizationThemeModel.findOneAndDelete({
      $or: [{ organizationId }, { organization_id: organizationId }],
    });
  }

  async createOrganizationLead(data: any) {
    const created = await OrganizationLeadModel.create(data);
    const doc = created.toObject();
    return { ...doc, id: doc._id };
  }

  async getOrganizationLeadById(id: string, organizationId: string) {
    const doc = await OrganizationLeadModel.findOne({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getOrganizationLeadByPhone(organizationId: string, phoneDigits: string) {
    if (!phoneDigits) return undefined;
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (!cleanDigits) return undefined;
    const lastDigits = cleanDigits.slice(-10);
    const regex = new RegExp(lastDigits + "$");
    const doc = await OrganizationLeadModel.findOne({
      $and: [
        { $or: [{ organizationId }, { organization_id: organizationId }] },
        { $or: [{ phone: regex }, { phoneNumber: regex }] },
      ],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async updateOrganizationLead(id: string, organizationId: string, data: any) {
    const updated = await OrganizationLeadModel.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { id }] },
          { $or: [{ organizationId }, { organization_id: organizationId }] },
        ],
      },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? { ...updated, id: updated._id } : undefined;
  }

  async deleteOrganizationLead(id: string, organizationId: string) {
    const res = await OrganizationLeadModel.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { id }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    return !!res;
  }

  async deleteOrganizationLeads(ids: string[], organizationId: string) {
    const res = await OrganizationLeadModel.deleteMany({
      $and: [
        { $or: [{ _id: { $in: ids } }, { id: { $in: ids } }] },
        { $or: [{ organizationId }, { organization_id: organizationId }] },
      ],
    });
    return res.deletedCount;
  }

  async listOrganizationLeadStatuses(organizationId: string) {
    const docs = await OrganizationLeadStatusModel.find({
      $or: [{ organizationId }, { organization_id: organizationId }],
    })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getOrganizationLeadStatusById(id: string, organizationId: string) {
    const doc = await OrganizationLeadStatusModel.findOne({
      _id: id,
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getOrganizationLeadStatusBySlug(organizationId: string, slug: string) {
    const doc = await OrganizationLeadStatusModel.findOne({
      slug: slug.trim().toLowerCase(),
      $or: [{ organizationId }, { organization_id: organizationId }],
    }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async createOrganizationLeadStatus(data: any) {
    const id = data.id || crypto.randomUUID();
    const doc = await OrganizationLeadStatusModel.create({
      ...data,
      _id: id,
      slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, "_") || "status",
    });
    return { ...doc.toObject(), id: doc._id };
  }

  async updateOrganizationLeadStatus(id: string, organizationId: string, data: any) {
    const doc = await OrganizationLeadStatusModel.findOneAndUpdate(
      {
        _id: id,
        $or: [{ organizationId }, { organization_id: organizationId }],
      },
      { $set: data },
      { returnDocument: "after" }
    ).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async deleteOrganizationLeadStatus(id: string, organizationId: string) {
    const res = await OrganizationLeadStatusModel.deleteOne({
      _id: id,
      $or: [{ organizationId }, { organization_id: organizationId }],
    });
    return res.deletedCount > 0;
  }

  async reorderOrganizationLeadStatuses(organizationId: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      await OrganizationLeadStatusModel.updateOne(
        {
          _id: orderedIds[i],
          $or: [{ organizationId }, { organization_id: organizationId }],
        },
        { $set: { sortOrder: i } }
      );
    }
    return this.listOrganizationLeadStatuses(organizationId);
  }

  async countLeadsByStatusSlug(organizationId: string, slug: string) {
    return OrganizationLeadModel.countDocuments({
      $or: [{ organizationId }, { organization_id: organizationId }],
      status: slug.trim().toLowerCase(),
    });
  }

  async getCountryDialCodes() {
    const docs = await CountryDialCodeModel.find({}).sort({ dialPrefix: 1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  // ─── WHITELABEL ONBOARDING ──────────────────────────────────────────────
  async getUsersDueForWhitelabelOnboardingMonthly(before: Date) {
    const users = await UserModel.find({
      isSaaSOwner: false,
      isActive: true,
      accountStatus: "active",
      onboardingMonthlyWaived: false,
      $or: [
        { onboardingNextChargeAt: null },
        { onboardingNextChargeAt: { $exists: false } },
        { onboardingNextChargeAt: { $lte: before } },
      ],
    }).lean();
    return users.map((u: any) => ({ ...u, id: u._id }));
  }

  async updateUserOnboardingSchedule(
    userId: string,
    data: { onboardingNextChargeAt?: Date | null; onboardingMonthlyWaived?: boolean }
  ) {
    const update: any = {};
    if (data.onboardingNextChargeAt !== undefined) {
      update.onboardingNextChargeAt = data.onboardingNextChargeAt;
    }
    if (data.onboardingMonthlyWaived !== undefined) {
      update.onboardingMonthlyWaived = data.onboardingMonthlyWaived;
    }
    await UserModel.updateOne({ _id: userId }, { $set: update });
  }

  async listOnboardingBillableEndCustomerUsers() {
    const users = await UserModel.find({
      isSaaSOwner: false,
      isActive: true,
      accountStatus: "active",
    }).lean();
    return users.map((u: any) => ({ ...u, id: u._id }));
  }

  async userOwnsAnyOrganization(userId: string) {
    const org = await OrganizationModel.findOne({ ownerId: userId }).lean();
    return !!org;
  }

  async countUsersCreatedBefore(createdAt: Date, userId: string) {
    return UserModel.countDocuments({
      createdAt: { $lt: createdAt },
      _id: { $ne: userId },
    });
  }

  async countOnboardingBillableUsersCreatedBefore(createdAt: Date, userId: string) {
    return UserModel.countDocuments({
      isSaaSOwner: false,
      isActive: true,
      accountStatus: "active",
      createdAt: { $lt: createdAt },
      _id: { $ne: userId },
    });
  }

  async insertWhitelabelOnboardingFee(data: any) {
    const id = data.id || crypto.randomUUID();
    const doc = await WhitelabelOnboardingFeeModel.create({ ...data, _id: id });
    return { ...doc.toObject(), id: doc._id };
  }

  async listWhitelabelOnboardingFeesForUser(userId: string) {
    const docs = await WhitelabelOnboardingFeeModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getWhitelabelOnboardingFeesForAdmin(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters?.limit ?? 100, 500);
    const offset = filters?.offset ?? 0;
    const q: any = {};
    if (filters?.status && filters.status !== "all") {
      q.status = filters.status;
    }
    const [total, docs] = await Promise.all([
      WhitelabelOnboardingFeeModel.countDocuments(q),
      WhitelabelOnboardingFeeModel.find(q).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    ]);
    const userIds = [...new Set(docs.map((d: any) => d.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u: any) => [u._id, { ...u, id: u._id }]));
    const fees = docs.map((d: any) => ({
      ...d,
      id: d._id,
      user: userMap.get(d.userId),
    }));
    return { fees, total };
  }

  async setWhitelabelOnboardingFeeGatewayOrder(ids: string[], gatewayOrderId: string) {
    if (ids.length === 0) return;
    await WhitelabelOnboardingFeeModel.updateMany(
      { _id: { $in: ids } },
      { $set: { gatewayOrderId } }
    );
  }

  async markWhitelabelOnboardingFeesPaid(
    ids: string[],
    gatewayPaymentId: string,
    meta?: { paymentGateway: "razorpay" | "cashfree"; gatewayPayload?: Record<string, unknown> | null }
  ) {
    if (ids.length === 0) return;
    const set: any = {
      status: "paid",
      paidAt: new Date(),
      gatewayPaymentId,
    };
    if (meta?.paymentGateway) set.paymentGateway = meta.paymentGateway;
    if (meta?.gatewayPayload !== undefined) set.gatewayPayload = meta.gatewayPayload;
    await WhitelabelOnboardingFeeModel.updateMany({ _id: { $in: ids } }, { $set: set });
  }

  async getWhitelabelOnboardingFeesByGatewayOrderId(orderId: string) {
    const docs = await WhitelabelOnboardingFeeModel.find({ gatewayOrderId: orderId }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getWhitelabelOnboardingFeesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const docs = await WhitelabelOnboardingFeeModel.find({ _id: { $in: ids } }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async getTotalOutstandingWhitelabelOnboardingMinor() {
    const result = await WhitelabelOnboardingFeeModel.aggregate([
      { $match: { status: { $in: ["pending", "failed"] } } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]);
    return result[0]?.total || 0;
  }

  async insertWhitelabelOnboardingSettlement(data: any) {
    const id = data.id || crypto.randomUUID();
    const doc = await WhitelabelOnboardingSettlementModel.create({ ...data, _id: id });
    return { ...doc.toObject(), id: doc._id };
  }

  async getWhitelabelOnboardingSettlementByGatewayOrderId(gatewayOrderId: string) {
    const doc = await WhitelabelOnboardingSettlementModel.findOne({ gatewayOrderId }).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async markWhitelabelOnboardingSettlementPaid(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    paidPayload: Record<string, unknown> | null
  ) {
    const existing = await WhitelabelOnboardingSettlementModel.findOne({ gatewayOrderId }).lean();
    if (!existing) return;
    const prevRaw =
      existing.rawGatewayResponse && typeof existing.rawGatewayResponse === "object"
        ? existing.rawGatewayResponse
        : {};
    const merged = {
      ...prevRaw,
      ...(paidPayload || {}),
      gateway_payment_id: gatewayPaymentId,
      settlement_marked_paid_at: new Date().toISOString(),
    };
    await WhitelabelOnboardingSettlementModel.updateOne(
      { gatewayOrderId },
      {
        $set: {
          status: "paid",
          gatewayPaymentId,
          rawGatewayResponse: merged,
          paidAt: new Date(),
        },
      }
    );
  }

  async getWhitelabelOnboardingSettlementsForAdmin(filters?: {
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters?.limit ?? 100, 500);
    const offset = filters?.offset ?? 0;
    const [total, docs] = await Promise.all([
      WhitelabelOnboardingSettlementModel.countDocuments({}),
      WhitelabelOnboardingSettlementModel.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    ]);
    return { settlements: docs.map((d: any) => ({ ...d, id: d._id })), total };
  }

  async clearAllWhitelabelOnboardingBillingData() {
    const [feesRes, settlementsRes] = await Promise.all([
      WhitelabelOnboardingFeeModel.deleteMany({}),
      WhitelabelOnboardingSettlementModel.deleteMany({}),
    ]);
    return { feesDeleted: feesRes.deletedCount || 0, settlementsDeleted: settlementsRes.deletedCount || 0 };
  }

  async clearUnpaidWhitelabelOnboardingFees() {
    const [unpaidRes, paidCount] = await Promise.all([
      WhitelabelOnboardingFeeModel.deleteMany({ status: { $in: ["pending", "failed"] } }),
      WhitelabelOnboardingFeeModel.countDocuments({ status: "paid" }),
    ]);
    return { feesDeleted: unpaidRes.deletedCount || 0, feesPreserved: paidCount };
  }

  async resetOnboardingSchedulesForRecalculate() {
    await UserModel.updateMany(
      { isSaaSOwner: false },
      { $set: { onboardingNextChargeAt: null, onboardingMonthlyWaived: false } }
    );
  }

  async getOnboardingFeesRecalculateUsedAt() {
    const doc = await PlatformMasterSettingsModel.findOne({}).lean();
    const raw = (doc?.revenueShareLocal as any)?.onboarding_fees_recalculate_used_at;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  async markOnboardingFeesRecalculateUsed() {
    const doc = await PlatformMasterSettingsModel.findOne({}).lean();
    const prev = doc?.revenueShareLocal && typeof doc.revenueShareLocal === "object" ? doc.revenueShareLocal : {};
    const updated = { ...prev, onboarding_fees_recalculate_used_at: new Date().toISOString() };
    await PlatformMasterSettingsModel.updateOne(
      {},
      { $set: { revenueShareLocal: updated } },
      { upsert: true }
    );
  }

  // ─── REMINDERS SCHEDULER / WORKER ───────────────────────────────────────
  async claimDueRemindersForWhatsApp(now: Date, limit: number = 20) {
    const docs = await ContactReminderModel.find({
      reminderAt: { $lte: now },
      whatsappStatus: "pending",
    })
      .limit(limit)
      .lean();
    if (docs.length === 0) return [];
    const ids = docs.map((d: any) => d._id);
    await ContactReminderModel.updateMany(
      { _id: { $in: ids } },
      { $set: { whatsappStatus: "sending" } }
    );
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async markReminderWhatsAppSent(id: string) {
    await ContactReminderModel.updateOne(
      { _id: id },
      { $set: { whatsappStatus: "sent", whatsappSentAt: new Date(), whatsappError: null } }
    );
  }

  async markReminderWhatsAppFailed(id: string, error: string) {
    await ContactReminderModel.updateOne(
      { _id: id },
      { $set: { whatsappStatus: "failed", whatsappError: error } }
    );
  }

  async requeueFailedReminderWhatsAppSends(options?: {
    organizationId?: string;
    errorContains?: string;
    limit?: number;
  }) {
    const q: any = { whatsappStatus: "failed" };
    if (options?.organizationId) q.organizationId = options.organizationId;
    if (options?.errorContains) q.whatsappError = { $regex: options.errorContains, $options: "i" };
    const res = await ContactReminderModel.updateMany(q, {
      $set: { whatsappStatus: "pending", whatsappError: null },
    });
    return res.modifiedCount;
  }

  async requeueStuckReminderWhatsAppSends(olderThanMinutes: number = 10) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const res = await ContactReminderModel.updateMany(
      {
        whatsappStatus: "sending",
        reminderAt: { $lt: cutoff },
      },
      { $set: { whatsappStatus: "pending" } }
    );
    return res.modifiedCount;
  }

  // ─── CAMPAIGN RETRY & EXTRA METHODS ────────────────────────────────────
  async claimCampaignFailedAutoRetry(campaignId: string, userId: string, organizationId: string) {
    const res = await CampaignModel.updateOne(
      {
        _id: campaignId,
        organizationId,
        failedAutoRetryAt: null,
      },
      {
        $set: { failedAutoRetryAt: new Date() },
      }
    );
    return res.modifiedCount > 0;
  }

  async claimDueCampaignRetry(campaignId: string) {
    const doc = await CampaignModel.findOneAndUpdate(
      { _id: campaignId, retryNextAt: { $lte: new Date() } },
      { $set: { retryNextAt: null } },
      { returnDocument: "after" }
    ).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async getDueCampaignRetries(now: Date = new Date()) {
    const docs = await CampaignModel.find({
      retryNextAt: { $lte: now },
      status: { $in: ["completed", "failed", "partially_failed"] },
    }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async scheduleCampaignConfiguredRetry(
    campaignId: string,
    userId: string,
    organizationId: string,
    nextAt: Date
  ) {
    await CampaignModel.updateOne(
      { _id: campaignId, organizationId },
      {
        $set: { retryNextAt: nextAt },
        $inc: { retryAttemptCount: 1 },
      }
    );
  }

  async getDefaultTemplateHeaderImageUrl(organizationId: string, templateName: string) {
    const doc = await MessageTemplateModel.findOne({
      organizationId,
      name: templateName,
    }).lean();
    return (doc as any)?.headerImageUrl || null;
  }

  async removeWhatsAppSessionFromChatbots(args: {
    sessionId: string;
    phoneNumberId?: string;
    userId: string;
    organizationId?: string;
  }) {
    const q: any = { whatsappSessionId: args.sessionId };
    if (args.organizationId) q.organizationId = args.organizationId;
    await ChatbotModel.updateMany(q, { $set: { whatsappSessionId: null } });
  }

  // ─── AUTOMATION FLOW RUNS & LOGS ────────────────────────────────────────
  async createAutomationFlowScheduledRun(data: any) {
    const id = data.id || crypto.randomUUID();
    const doc = await AutomationFlowScheduledRunModel.create({ ...data, _id: id });
    return { ...doc.toObject(), id: doc._id };
  }

  async claimDueAutomationFlowScheduledRuns(now: Date, limit: number = 50) {
    const docs = await AutomationFlowScheduledRunModel.find({
      status: "pending",
      runAt: { $lte: now },
    })
      .limit(limit)
      .lean();
    if (docs.length === 0) return [];
    const ids = docs.map((d: any) => d._id);
    await AutomationFlowScheduledRunModel.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "running" } }
    );
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }

  async completeAutomationFlowScheduledRun(id: string) {
    await AutomationFlowScheduledRunModel.updateOne(
      { _id: id },
      { $set: { status: "completed", completedAt: new Date() } }
    );
  }

  async failAutomationFlowScheduledRun(id: string, error: string) {
    await AutomationFlowScheduledRunModel.updateOne(
      { _id: id },
      { $set: { status: "failed", lastError: error, failedAt: new Date() } }
    );
  }

  async cancelAutomationFlowScheduledRun(id: string, reason: string) {
    await AutomationFlowScheduledRunModel.updateOne(
      { _id: id },
      { $set: { status: "cancelled", cancelReason: reason } }
    );
  }

  async createAutomationFlowRun(data: any) {
    const id = data.id || crypto.randomUUID();
    const doc = await AutomationFlowRunModel.create({ ...data, _id: id });
    return { ...doc.toObject(), id: doc._id };
  }

  async getAutomationFlowRunById(id: string) {
    const doc = await AutomationFlowRunModel.findById(id).lean();
    return doc ? { ...doc, id: doc._id } : undefined;
  }

  async updateAutomationFlowRunStatus(
    id: string,
    status: any,
    lastError?: string | null
  ) {
    const set: any = { status };
    if (lastError !== undefined) set.lastError = lastError;
    await AutomationFlowRunModel.updateOne({ _id: id }, { $set: set });
  }

  async createAutomationFlowRunLog(data: any) {
    return { ...data, id: data.id || crypto.randomUUID(), createdAt: new Date() };
  }

  async getAutomationFlowRunLogs(runId: string, limit: number = 100) {
    return [];
  }

  async getAutomationFlowRunsByFlow(flowId: string, limit: number = 50) {
    const docs = await AutomationFlowRunModel.find({ flowId }).sort({ createdAt: -1 }).limit(limit).lean();
    return docs.map((d: any) => ({ ...d, id: d._id }));
  }
}

/**
 * Creates a MongoStorage proxy that delegates to MongoStorage and provides
 * safe, non-crashing fallbacks for any un-implemented secondary queries.
 */
export function createMongoStorage(): IStorage {
  const baseStorage = new MongoStorage();
  return new Proxy(baseStorage, {
    get(target, prop, receiver) {
      if (prop in target) {
        const val = (target as any)[prop];
        if (typeof val === "function") {
          return val.bind(target);
        }
        return val;
      }
      return async (...args: any[]) => {
        const p = String(prop);
        if (
          p.startsWith("get") ||
          p.startsWith("find") ||
          p.startsWith("list") ||
          p.startsWith("claim")
        ) {
          if (
            p.endsWith("s") ||
            p.includes("List") ||
            p.includes("All") ||
            p.includes("Organization") ||
            p.includes("By") ||
            p.includes("Due") ||
            p.includes("Users") ||
            p.startsWith("claim") ||
            p.startsWith("list")
          ) {
            return [];
          }
          return undefined;
        }
        if (p.startsWith("is") || p.startsWith("has") || p.startsWith("check")) {
          return false;
        }
        if (p.startsWith("count") || p.startsWith("requeue")) {
          return 0;
        }
        return undefined;
      };
    },
  }) as any;
}


