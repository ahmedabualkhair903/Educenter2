"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSend,
  FiStar,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { useAppSettings } from "@/components/providers";
import TimePicker from "@/components/common/TimePicker";
import Image from "next/image";
import { messageService } from "@/services";
import { groupService } from "@/services/groupService";
import { studentService } from "@/services/studentService";
import {
  whatsappAccountService,
  type WhatsAppAccount,
  type WhatsAppTestResult,
} from "@/services/whatsappAccountService";
import { ApiError } from "@/lib/api";
import { formatTime12 } from "@/lib/time";

import {
  MAX_ATTACHMENT_BYTES,
  MESSAGE_ATTACHMENT_MIMES,
} from "@/types/message";
import type {
  MessageAttachment,
  MessageStatus,
  MessageType,
  WhatsAppMessage,
} from "@/types/message";
import type { Group, Student } from "@/types";

type MessageRecord = WhatsAppMessage & {
  title: string;
  recipient: string;
  recipientsCount: number;
};

function mapServiceMessage(
  message: WhatsAppMessage,
): MessageRecord {
  const recipientLabel =
    (message as { studentName?: string }).studentName ||
    message.recipient ||
    message.guardianPhone ||
    message.recipientPhone ||
    message.phone ||
    message.studentId ||
    "—";
  return {
    ...message,
    title: message.title ?? "رسالة",
    recipient: recipientLabel,
    recipientsCount:
      message.recipientsCount ?? 1,
  };
}

function toFriendlyMessageError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "STUDENT_NOT_FOUND":
        return "الطالب المحدد غير موجود. حدّث قائمة الطلاب وحاول مرة أخرى.";
      case "GROUP_NOT_FOUND":
        return "إحدى المجموعات المحددة غير موجودة. حدّث القائمة وحاول مرة أخرى.";
      case "NO_PHONE":
        return "الطالب المحدد ليس لديه رقم هاتف (ولي الأمر أو الطالب).";
      case "NO_RECIPIENTS":
        return "لا يوجد مستلمون صالحون في المجموعات المحددة (بدون أرقام هواتف).";
      case "STUDENT_REQUIRED":
        return "يرجى اختيار الطالب المستلم.";
      case "GROUPS_REQUIRED":
        return "يرجى اختيار مجموعة واحدة على الأقل.";
      case "VALIDATION_ERROR":
        return error.message || "بيانات الرسالة غير مكتملة. راجع الحقول المطلوبة.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "تعذر حفظ الرسالة.";
}

/** تحويل ISO (YYYY-MM-DD) إلى العرض DD/MM/YYYY */
function formatDateDMY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const statusOptions: Array<{
  value: "all" | MessageStatus;
  label: string;
}> = [
  { value: "all", label: "كل الحالات" },
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "مجدولة" },
  { value: "draft", label: "مسودة" },
  { value: "failed", label: "Failed" },
];

const typeOptions: Array<{
  value: "all" | MessageType;
  label: string;
}> = [
  { value: "all", label: "كل الأنواع" },
  { value: "individual", label: "فردية" },
  { value: "group", label: "مجموعة" },
  { value: "notification", label: "إشعار" },
  { value: "reminder", label: "تذكير" },
  { value: "examResult", label: "نتائج" },
  { value: "attendance", label: "حضور" },
  { value: "checkOut", label: "انصراف" },
  { value: "absence", label: "غياب" },
];

export default function MessagesPage() {
  const { settings, isModuleEnabled } = useAppSettings();

  const [messages, setMessages] =
    useState<MessageRecord[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | MessageStatus>("all");

  const [typeFilter, setTypeFilter] =
    useState<"all" | MessageType>("all");

  const [modalOpen, setModalOpen] = useState(false);

  const [editingMessage, setEditingMessage] =
    useState<MessageRecord | null>(null);

  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<WhatsAppAccount | null>(null);

  const [testingAccount, setTestingAccount] =
    useState<WhatsAppAccount | null>(null);

  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      try {
        const data = await messageService.list();

        if (mounted) {
          setMessages(data.map(mapServiceMessage));
        }
      } catch {
        // Keep the list empty; errors surface on next action.
      }
    };

    const loadAccounts = async () => {
      try {
        const data = await whatsappAccountService.list();

        if (mounted) {
          setAccounts(data);
          setAccountsError("");
        }
      } catch (error) {
        if (mounted) {
          setAccounts([]);
          setAccountsError(
            error instanceof Error
              ? error.message
              : "تعذر تحميل حسابات الإرسال.",
          );
        }
      } finally {
        if (mounted) {
          setAccountsLoading(false);
        }
      }
    };

    void loadMessages();
    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshAccounts = async () => {
    try {
      const data = await whatsappAccountService.list();
      setAccounts(data);
      setAccountsError("");
    } catch (error) {
      setAccountsError(
        error instanceof Error
          ? error.message
          : "تعذر تحميل حسابات الإرسال.",
      );
    }
  };

  function toFriendlyAccountError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.statusCode === 403) {
        return "لا تملك صلاحية إدارة حسابات الإرسال (مطلوب حساب مدير).";
      }
      return error.message;
    }
    return error instanceof Error
      ? error.message
      : "تعذر تنفيذ العملية على الحساب.";
  }

  const handleSaveAccount = async (data: {
    phoneNumber: string;
    providerName: string;
    apiUrl: string;
    apiToken?: string;
    isDefault: boolean;
    status: "active" | "inactive";
  }) => {
    if (editingAccount) {
      const payload: Partial<typeof data> = { ...data };
      // التوكن الفارغ في التعديل يعني: إبقاء القديم دون تغيير
      if (!payload.apiToken?.trim()) {
        delete payload.apiToken;
      }
      await whatsappAccountService.update(editingAccount.id, payload);
    } else {
      await whatsappAccountService.create(data as Required<typeof data>);
    }
    await refreshAccounts();
    setAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = async (account: WhatsAppAccount) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف حساب الإرسال "${account.phoneNumber}"؟`,
    );
    if (!confirmed) return;

    setAccountBusyId(account.id);
    try {
      await whatsappAccountService.remove(account.id);
      await refreshAccounts();
    } catch (error) {
      window.alert(toFriendlyAccountError(error));
    } finally {
      setAccountBusyId(null);
    }
  };

  const handleSetDefaultAccount = async (account: WhatsAppAccount) => {
    setAccountBusyId(account.id);
    try {
      await whatsappAccountService.setDefault(account.id);
      await refreshAccounts();
    } catch (error) {
      window.alert(toFriendlyAccountError(error));
    } finally {
      setAccountBusyId(null);
    }
  };

  const whatsappEnabled =
    isModuleEnabled("whatsapp") &&
    settings.notifications.whatsappEnabled;

  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();

    return messages.filter((message) => {
      const searchableText = [
        message.title,
        message.recipient,
        message.content ?? "",
        message.error ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        searchableText.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        message.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        message.type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    messages,
    search,
    statusFilter,
    typeFilter,
  ]);

  const sentCount = messages.filter(
    (message) => message.status === "sent",
  ).length;

  const pendingCount = messages.filter(
    (message) => message.status === "pending",
  ).length;

  const failedCount = messages.filter(
    (message) => message.status === "failed",
  ).length;

  const scheduledCount = messages.filter(
    (message) => message.status === "scheduled",
  ).length;

  const totalRecipients = messages.reduce(
    (total, message) =>
      total + message.recipientsCount,
    0,
  );

  const defaultAccount = useMemo(
    () => accounts.find((account) => account.isDefault) ?? null,
    [accounts],
  );

  const [editingAttachment, setEditingAttachment] =
    useState<MessageAttachment | null>(null);

  const openCreateModal = () => {
    setEditingMessage(null);
    setEditingAttachment(null);
    setModalOpen(true);
  };

  const openEditModal = async (
    message: MessageRecord,
  ) => {
    setEditingMessage(message);
    setEditingAttachment(null);
    setModalOpen(true);

    // تحميل بيانات المرفق الكاملة للمعاينة عند التعديل
    if (message.hasAttachment) {
      try {
        const full = await messageService.getById(message.id);
        if (full?.attachmentData) {
          setEditingAttachment({
            data: full.attachmentData,
            name: full.attachmentName ?? "مرفق",
            mime: full.attachmentMime ?? "",
            size: full.attachmentSize ?? 0,
          });
        }
      } catch {
        // تبقى المعاينة فارغة؛ التعديل النصي يعمل بشكل طبيعي
      }
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMessage(null);
    setEditingAttachment(null);
  };

  const handleSave = async (
    data: Omit<
      MessageRecord,
      "id" | "createdAt" | "sentAt"
    > & {
      recipientType?: "student" | "groups";
      studentId?: string;
      groupIds?: string[];
      attachment?: MessageAttachment | null;
      accountId?: string | null;
    },
  ) => {
    if (editingMessage) {
      const updated = await messageService.update(
        editingMessage.id,
        data,
      );

      if (updated) {
        setMessages((current) =>
          current.map((message) =>
            message.id === editingMessage.id
              ? {
                  ...mapServiceMessage(updated),
                  recipient: message.recipient,
                }
              : message,
          ),
        );
      }
      closeModal();
    } else {
      // بث جديد: studentId أو groupIds حسب نوع المستلم
      const created = await messageService.create({
        title: data.title,
        message: data.content ?? "",
        type: data.type,
        status: data.status,
        recipientType: data.recipientType ?? "student",
        studentId: data.studentId,
        groupIds: data.groupIds,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        attachment: data.attachment ?? undefined,
        accountId: data.accountId ?? undefined,
      });

      if (
        created &&
        typeof created === "object" &&
        "notifications" in created
      ) {
        const skipped = created.skipped ?? [];
        const fresh = await messageService.list();
        setMessages(fresh.map(mapServiceMessage));
        closeModal();
        if (skipped.length > 0) {
          window.alert(
            `تمت الجدولة مع تخطي ${skipped.length}:\n` +
              skipped
                .slice(0, 10)
                .map((item) => `• ${item.reason}`)
                .join("\n")
          );
        }
      } else if (created) {
        setMessages((current) => [
          mapServiceMessage(
            created as WhatsAppMessage,
          ),
          ...current,
        ]);
        closeModal();
      }
    }
  };

  const handleDelete = async (
    message: MessageRecord,
  ) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${message.title}"؟`,
    );

    if (!confirmed) {
      return;
    }

    const success = await messageService.delete(
      message.id,
    );

    if (success) {
      setMessages((current) =>
        current.filter(
          (item) => item.id !== message.id,
        ),
      );
    }
  };

  const handleSend = async (
    message: MessageRecord,
  ) => {
    if (
      !whatsappEnabled ||
      message.status === "sent" ||
      message.status === "pending"
    ) {
      return;
    }

    const updated = await messageService.update(
      message.id,
      {
        status: "pending",
        error: undefined,
      },
    );

    if (updated) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                status: "pending",
                error: undefined,
              }
            : item,
        ),
      );
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#F3F6FB] text-[#10275B]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-[#DCE5F2] bg-gradient-to-l from-[#EAF0FF] via-white to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>الرئيسية</span>
              <span>/</span>
              <span className="text-[#1748EF]">
                الرسائل
              </span>
            </div>

            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#D6E0F4] bg-white/80 px-3 py-1 text-[11px] font-bold text-[#10275B]">
              <FiMessageCircle size={13} className="text-[#1748EF]" />
              مركز التواصل
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#10275B] sm:text-3xl">
              الرسائل والتواصل
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              تجهيز ومتابعة رسائل النتائج
              والحضور والانصراف والغياب.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!whatsappEnabled}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1748EF] px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(23,72,239,0.18)] transition hover:bg-[#10275B] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            <FiPlus size={17} />
            رسالة جديدة
          </button>
        </div>

        {!whatsappEnabled && (
          <section className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <FiAlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div>
              <p className="text-sm font-bold text-amber-800">
                WhatsApp غير مفعّل
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                فعّل Module الخاص بـWhatsApp
                من الإعدادات حتى تتمكن من
                تجهيز الرسائل.
              </p>
            </div>
          </section>
        )}

        <section aria-label="ملخص الرسائل" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MessageStat
            label="Sent"
            value={sentCount}
            icon={<FiCheckCircle size={19} />}
          />

          <MessageStat
            label="Pending"
            value={pendingCount}
            icon={<FiClock size={19} />}
          />

          <MessageStat
            label="Failed"
            value={failedCount}
            icon={<FiAlertCircle size={19} />}
          />

          <MessageStat
            label="مجدولة"
            value={scheduledCount}
            icon={<FiClock size={19} />}
          />

          <MessageStat
            label="إجمالي المستلمين"
            value={totalRecipients}
            icon={<FiUsers size={19} />}
          />
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-[#D6E0F4] bg-gradient-to-l from-[#EAF0FF] via-white to-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DCE7FF] text-[#10275B]">
                <FiMessageCircle size={21} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  WhatsApp
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {accountsLoading
                    ? "جاري تحميل حسابات الإرسال..."
                    : defaultAccount
                      ? `المرسل الافتراضي: ${defaultAccount.phoneNumber} (${defaultAccount.providerName})`
                      : "لا يوجد حساب إرسال افتراضي — أضف حساباً من الأسفل."}
                </p>
              </div>
            </div>

            <span
              className={[
                "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold",
                whatsappEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  whatsappEnabled
                    ? "bg-emerald-500"
                    : "bg-slate-400",
                ].join(" ")}
              />

              {whatsappEnabled
                ? "الوحدة مفعلة"
                : "الوحدة متوقفة"}
            </span>
          </div>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-[#DCE5F2] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E8EDF5] bg-[#FAFBFE] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                حسابات الإرسال
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                أرقام المرسلين والبوابات — الحساب الافتراضي يُستخدم
                تلقائياً ما لم تختر حساباً آخر عند إنشاء الرسالة.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setAccountModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1748EF] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10275B]"
            >
              <FiPlus size={16} />
              إضافة حساب
            </button>
          </div>

          <div className="p-5">
            {accountsLoading ? (
              <p className="py-6 text-center text-xs text-slate-400">
                جاري تحميل حسابات الإرسال...
              </p>
            ) : accountsError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                {accountsError}
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                <p className="text-xs font-bold text-slate-600">
                  لا توجد حسابات إرسال بعد
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  أضف أول حساب (رقم + رابط البوابة + المفتاح) ليبدأ
                  الإرسال الفعلي بدل المحاكاة.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={[
                      "rounded-xl border p-4 transition",
                      account.isDefault
                        ? "border-[#1748EF] bg-[#EEF3FF]/50 ring-4 ring-[#1748EF]/10"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          dir="ltr"
                          className="text-left text-sm font-bold text-slate-800"
                        >
                          {account.phoneNumber}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {account.providerName}
                          </span>

                          {account.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#1748EF] px-2 py-0.5 text-[10px] font-bold text-white">
                              <FiStar size={10} />
                              افتراضي
                            </span>
                          )}

                          <span
                            className={[
                              "rounded-md px-2 py-0.5 text-[10px] font-bold",
                              account.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500",
                            ].join(" ")}
                          >
                            {account.status === "active"
                              ? "نشط"
                              : "موقوف"}
                          </span>
                        </div>

                        <p className="mt-1.5 truncate text-[10px] text-slate-400" dir="ltr">
                          token: {account.apiTokenMasked ?? "****"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!account.isDefault && (
                          <button
                            type="button"
                            title="تعيين كافتراضي"
                            aria-label={`تعيين ${account.phoneNumber} كافتراضي`}
                            disabled={accountBusyId === account.id}
                            onClick={() =>
                              void handleSetDefaultAccount(account)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
                          >
                            <FiStar size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          title="اختبار الاتصال"
                          aria-label={`اختبار ${account.phoneNumber}`}
                          onClick={() =>
                            setTestingAccount(account)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#EEF3FF] hover:text-[#1748EF]"
                        >
                          <FiSend size={15} />
                        </button>

                        <button
                          type="button"
                          title="تعديل"
                          aria-label={`تعديل ${account.phoneNumber}`}
                          onClick={() => {
                            setEditingAccount(account);
                            setAccountModalOpen(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <FiEdit2 size={15} />
                        </button>

                        <button
                          type="button"
                          title="حذف"
                          aria-label={`حذف ${account.phoneNumber}`}
                          disabled={accountBusyId === account.id}
                          onClick={() =>
                            void handleDeleteAccount(account)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-[#DCE5F2] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <FiSearch
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="ابحث في الرسائل أو المستلمين..."
                aria-label="البحث في الرسائل"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:bg-white focus:ring-4 focus:ring-[#1748EF]/10"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as
                    | "all"
                    | MessageType,
                )
              }
              aria-label="فلترة حسب النوع"
              className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
            >
              {typeOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "all"
                    | MessageStatus,
                )
              }
              aria-label="فلترة حسب الحالة"
              className="h-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5F2] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8EDF5] bg-[#FAFBFE] px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                سجل الرسائل
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                عرض {filteredMessages.length} رسالة
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <FiSend size={14} />
              WhatsApp
            </div>
          </div>

          {filteredMessages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-right">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      الرسالة
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      المستلمون
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      النوع
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      التاريخ
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      العدد
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      الحالة
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                      الإجراءات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMessages.map((message) => (
                    <tr
                      key={message.id}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="max-w-[330px] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF3FF] text-[#1748EF]">
                            <FiMessageCircle size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
                              <span className="truncate">
                                {message.title}
                              </span>

                              {message.hasAttachment && (
                                <span
                                  title={
                                    message.attachmentName ??
                                    "يوجد مرفق"
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500"
                                >
                                  <FiPaperclip size={10} />
                                  مرفق
                                </span>
                              )}
                            </p>

                            <p className="mt-1 truncate text-[11px] text-slate-400">
                              {message.content}
                            </p>

                            {message.error && (
                              <p className="mt-1 truncate text-[10px] text-red-500">
                                {message.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-slate-600">
                          {message.recipient}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <MessageTypeBadge
                          type={message.type}
                        />
                      </td>

                      <td className="px-5 py-4">
                        {message.scheduledDate ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-600">
                              {message.scheduledDate}
                            </p>

                            {message.scheduledTime && (
                              <p className="mt-1 text-[10px] text-slate-400">
                                {formatTime12(
                                  message.scheduledTime,
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FiUsers
                            size={14}
                            className="text-slate-400"
                          />

                          <span className="text-sm font-semibold text-slate-700">
                            {message.recipientsCount}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <MessageStatusBadge
                          status={message.status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(message)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            title="تعديل"
                            aria-label={`تعديل ${message.title}`}
                          >
                            <FiEdit2 size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleSend(message)
                            }
                            disabled={
                              !whatsappEnabled ||
                              message.status === "sent" ||
                              message.status === "pending"
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#EEF3FF] hover:text-[#1748EF] disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              message.status === "sent"
                                ? "تم الإرسال"
                                : message.status === "pending"
                                  ? "Pending"
                                  : "تجهيز للإرسال"
                            }
                            aria-label={`إرسال ${message.title}`}
                          >
                            <FiSend size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(message)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="حذف"
                            aria-label={`حذف ${message.title}`}
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FiMessageCircle size={20} />
              </div>

              <h3 className="mt-4 text-sm font-bold text-slate-800">
                لا توجد رسائل
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                جرّب تغيير البحث أو الفلاتر.
              </p>
            </div>
          )}
        </section>
      </div>

      <MessageModal
        key={`${modalOpen}-${editingMessage?.id ?? "new"}`}
        open={modalOpen}
        message={editingMessage}
        initialAttachment={editingAttachment}
        accounts={accounts}
        onClose={closeModal}
        onSubmit={handleSave}
      />

      {accountModalOpen && (
        <AccountModal
          key={editingAccount?.id ?? "new-account"}
          open={accountModalOpen}
          account={editingAccount}
          onClose={() => {
            setAccountModalOpen(false);
            setEditingAccount(null);
          }}
          onSubmit={handleSaveAccount}
        />
      )}

      {testingAccount && (
        <AccountTestModal
          account={testingAccount}
          onClose={() => setTestingAccount(null)}
        />
      )}
    </main>
  );
}

function MessageStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#DCE5F2] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#1748EF]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MessageStatusBadge({
  status,
}: {
  status: MessageStatus;
}) {
  const styles: Record<MessageStatus, string> = {
    sent: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    scheduled: "bg-blue-50 text-blue-700",
    draft: "bg-slate-100 text-slate-600",
    failed: "bg-red-50 text-red-700",
  };

  const labels: Record<MessageStatus, string> = {
    sent: "Sent",
    pending: "Pending",
    scheduled: "مجدولة",
    draft: "مسودة",
    failed: "Failed",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function MessageTypeBadge({
  type,
}: {
  type: MessageType;
}) {
  const labels: Record<MessageType, string> = {
    individual: "فردية",
    group: "مجموعة",
    notification: "إشعار",
    reminder: "تذكير",
    examResult: "نتائج",
    attendance: "حضور",
    checkOut: "انصراف",
    absence: "غياب",
  };

  return (
    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      {labels[type]}
    </span>
  );
}

function MessageModal({
  open,
  message,
  initialAttachment,
  accounts,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message: MessageRecord | null;
  initialAttachment?: MessageAttachment | null;
  accounts: WhatsAppAccount[];
  onClose: () => void;
  onSubmit: (
    data: Omit<
      MessageRecord,
      "id" | "createdAt" | "sentAt"
    > & {
      recipientType?: "student" | "groups";
      studentId?: string;
      groupIds?: string[];
      attachment?: MessageAttachment | null;
      accountId?: string | null;
    },
  ) => void | Promise<void>;
}) {
  const isEdit = Boolean(message);

  const [title, setTitle] = useState(
    message?.title ?? "",
  );

  const [recipientType, setRecipientType] =
    useState<"student" | "groups">("student");

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentId, setStudentId] = useState(
    message?.studentId ?? "",
  );

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [type, setType] = useState<MessageType>(
    message?.type ?? "individual",
  );

  const [accountId, setAccountId] = useState(
    message?.whatsappAccountId ?? "",
  );

  const [content, setContent] = useState(
    message?.content ?? "",
  );

  const [date, setDate] = useState(() => {
    const initial = message?.scheduledDate ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(initial.trim())
      ? initial.trim()
      : "";
  });

  const [time, setTime] = useState(
    message?.scheduledTime ?? "",
  );

  const [status, setStatus] =
    useState<MessageStatus>(
      message?.status ?? "draft",
    );

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [attachment, setAttachment] =
    useState<MessageAttachment | null>(
      initialAttachment ?? null,
    );
  const [attachmentDirty, setAttachmentDirty] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (file: File | undefined) => {
    setAttachmentError("");
    if (!file) return;

    if (
      !(MESSAGE_ATTACHMENT_MIMES as readonly string[]).includes(file.type)
    ) {
      setAttachmentError("نوع الملف غير مدعوم. المسموح: صور (JPG/PNG/GIF/WebP) و PDF.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("حجم الملف يتجاوز الحد المسموح (3MB).");
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : "";
      setReadingFile(false);
      if (!dataUrl.startsWith("data:")) {
        setAttachmentError("تعذر قراءة الملف. حاول مرة أخرى.");
        return;
      }
      setAttachment({
        data: dataUrl,
        name: file.name.slice(0, 150),
        mime: file.type,
        size: file.size,
      });
      setAttachmentDirty(true);
    };
    reader.onerror = () => {
      setReadingFile(false);
      setAttachmentError("تعذر قراءة الملف. حاول مرة أخرى.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setAttachmentDirty(true);
    setAttachmentError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!open || isEdit) return;
    let mounted = true;
    Promise.all([
      studentService.list().catch(() => []),
      groupService.list().catch(() => []),
    ])
      .then(([studentList, groupList]) => {
        if (!mounted) return;
        setStudents(studentList);
        setGroups(
          groupList.filter((group) => group.status === "active"),
        );
      })
      .finally(() => {
        if (mounted) setListsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, isEdit]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return students.filter((student) => {
      if (!query) return true;
      return [student.name, student.studentId, student.grade ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [students, studentSearch]);

  const selectedStudent =
    students.find((student) => student.id === studentId) ?? null;

  const estimatedRecipients =
    recipientType === "student"
      ? studentId
        ? 1
        : 0
      : selectedGroupIds.reduce((total, groupId) => {
          const group = groups.find((item) => item.id === groupId);
          return total + (group?.studentCount ?? 0);
        }, 0);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
    setError("");
  };

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError("يرجى إدخال عنوان الرسالة ومحتوى الرسالة.");
      return;
    }

    let resolvedStudentId: string | undefined;
    let resolvedGroupIds: string[] | undefined;

    if (!isEdit) {
      if (recipientType === "student") {
        if (!studentId) {
          setError("يرجى اختيار الطالب المستلم من القائمة.");
          return;
        }
        if (!students.some((student) => student.id === studentId)) {
          setError("الطالب المحدد غير موجود. حدّث القائمة وحاول مرة أخرى.");
          return;
        }
        resolvedStudentId = studentId;
      } else {
        if (selectedGroupIds.length === 0) {
          setError("يرجى اختيار مجموعة واحدة على الأقل.");
          return;
        }
        const unknown = selectedGroupIds.filter(
          (id) => !groups.some((group) => group.id === id),
        );
        if (unknown.length > 0) {
          setError("إحدى المجموعات المحددة غير موجودة. حدّث القائمة وحاول مرة أخرى.");
          return;
        }
        resolvedGroupIds = selectedGroupIds;
      }
    }

    if (
      status === "scheduled" &&
      (!date.trim() || !time.trim())
    ) {
      setError("يرجى إدخال تاريخ ووقت الجدولة.");
      return;
    }

    if (date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError("التاريخ يجب أن يكون بصيغة يوم / شهر / سنة (DD/MM/YYYY).");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        recipient:
          isEdit
            ? (message?.recipient ?? "")
            : recipientType === "student"
              ? (selectedStudent?.name ?? "")
              : selectedGroupIds
                  .map(
                    (id) =>
                      groups.find((group) => group.id === id)?.name ?? id,
                  )
                  .join("، "),
        type,
        content: content.trim(),
        recipientsCount: isEdit
          ? (message?.recipientsCount ?? 1)
          : Math.max(estimatedRecipients, 1),
        status,
        scheduledDate:
          status === "draft"
            ? undefined
            : date.trim() || undefined,
        scheduledTime:
          status === "draft"
            ? undefined
            : time.trim() || undefined,
        studentId: isEdit ? (message?.studentId ?? "") : (resolvedStudentId ?? ""),
        guardianPhone: message?.guardianPhone ?? "",
        recipientType: isEdit ? undefined : recipientType,
        groupIds: resolvedGroupIds,
        // فارغ = الحساب الافتراضي؛ وفي التعديل null صريح لفك ربط سابق
        accountId: accountId.trim()
          ? accountId.trim()
          : isEdit && message?.whatsappAccountId
            ? null
            : undefined,
        // في التعديل: يُرسل المرفق فقط عند تغييره (إضافة/إزالة) حتى لا يُمسح
        // عن طريق الخطأ قبل اكتمال تحميل المعاينة، وفي الإنشاء يُرسل كما هو
        attachment: isEdit
          ? (attachmentDirty ? attachment : undefined)
          : (attachment ?? undefined),
        error:
          status === "failed"
            ? "تعذر تجهيز الرسالة."
            : undefined,
      });
    } catch (submitError) {
      setError(toFriendlyMessageError(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit
                ? "تعديل الرسالة"
                : "إنشاء رسالة جديدة"}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              تجهيز الرسالة فقط. الإرسال الحقيقي
              سيتم لاحقًا من خلال Backend.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <FiX size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <MessageField label="عنوان الرسالة">
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                placeholder="مثال: نتيجة امتحان الفيزياء"
                className="field"
              />
            </MessageField>

            <MessageField label="نوع الرسالة">
              <select
                value={type}
                onChange={(event) => {
                  setType(
                    event.target.value as MessageType,
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="individual">
                  فردية
                </option>

                <option value="group">
                  مجموعة
                </option>

                <option value="examResult">
                  نتائج الامتحانات
                </option>

                <option value="attendance">
                  حضور
                </option>

                <option value="checkOut">
                  انصراف
                </option>

                <option value="absence">
                  غياب
                </option>

                <option value="notification">
                  إشعار
                </option>

                <option value="reminder">
                  تذكير
                </option>
              </select>
            </MessageField>

            {!isEdit && (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  جهة الإرسال <span className="mr-1 text-red-500">*</span>
                </span>

                <div
                  role="radiogroup"
                  aria-label="جهة الإرسال"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recipientType === "student"}
                    onClick={() => {
                      setRecipientType("student");
                      setError("");
                    }}
                    className={[
                      "flex items-center gap-3 rounded-xl border p-3 text-right transition",
                      recipientType === "student"
                        ? "border-[#1748EF] bg-[#EEF3FF]/60 ring-4 ring-[#1748EF]/10"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        recipientType === "student"
                          ? "bg-[#1748EF] text-white"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      <FiUser size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-800">
                        طالب واحد
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        رسالة فردية لولي أمر طالب
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={recipientType === "groups"}
                    onClick={() => {
                      setRecipientType("groups");
                      setError("");
                    }}
                    className={[
                      "flex items-center gap-3 rounded-xl border p-3 text-right transition",
                      recipientType === "groups"
                        ? "border-[#1748EF] bg-[#EEF3FF]/60 ring-4 ring-[#1748EF]/10"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        recipientType === "groups"
                          ? "bg-[#1748EF] text-white"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      <FiUsers size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-800">
                        مجموعة واحدة أو أكثر
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        رسالة جماعية (Multicast)
                      </span>
                    </span>
                  </button>
                </div>

                {recipientType === "student" ? (
                  <div className="mt-3">
                    <div className="relative mb-2">
                      <FiSearch
                        size={15}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="search"
                        value={studentSearch}
                        onChange={(event) =>
                          setStudentSearch(event.target.value)
                        }
                        placeholder="بحث سريع باسم الطالب أو الكود..."
                        aria-label="بحث سريع عن طالب"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1748EF] focus:bg-white focus:ring-4 focus:ring-[#1748EF]/10"
                      />
                    </div>

                    <select
                      value={studentId}
                      onChange={(event) => {
                        setStudentId(event.target.value);
                        setError("");
                      }}
                      aria-label="اختيار الطالب"
                      className="field"
                    >
                      <option value="">
                        {listsLoading
                          ? "جاري تحميل الطلاب..."
                          : "اختر الطالب"}
                      </option>
                      {filteredStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} — {student.studentId}
                          {student.grade ? ` · ${student.grade}` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedStudent && (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        سيتم الإرسال إلى ولي أمر{" "}
                        <span className="font-bold text-slate-700">
                          {selectedStudent.name}
                        </span>{" "}
                        ({selectedStudent.guardianPhone || selectedStudent.phone || "بدون هاتف"})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {listsLoading
                          ? "جاري تحميل المجموعات..."
                          : `تم اختيار ${selectedGroupIds.length} من ${groups.length}`}
                      </span>
                      {selectedGroupIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedGroupIds([])}
                          className="text-[11px] font-semibold text-[#1748EF] hover:text-[#10275B]"
                        >
                          مسح الاختيار
                        </button>
                      )}
                    </div>

                    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                      {groups.length === 0 && !listsLoading && (
                        <p className="p-3 text-center text-xs text-slate-400">
                          لا توجد مجموعات نشطة.
                        </p>
                      )}
                      {groups.map((group) => {
                        const checked = selectedGroupIds.includes(group.id);
                        return (
                          <label
                            key={group.id}
                            className={[
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition",
                              checked
                                ? "border-[#1748EF] bg-[#EEF3FF]/70"
                                : "border-transparent bg-white hover:border-slate-200",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroup(group.id)}
                              className="h-4 w-4 shrink-0 accent-[#1748EF]"
                            />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-slate-700">
                              {group.name}
                              {group.grade ? (
                                <span className="font-normal text-slate-400">
                                  {" "}— {group.grade}
                                </span>
                              ) : null}
                            </span>
                            {typeof group.studentCount === "number" && (
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {group.studentCount} طالب
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <MessageField label="حساب الإرسال">
              <select
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value);
                  setError("");
                }}
                className="field"
              >
                <option value="">
                  {(() => {
                    const fallback = accounts.find(
                      (item) => item.isDefault,
                    );
                    return fallback
                      ? `الافتراضي: ${fallback.phoneNumber}`
                      : "الافتراضي (إن وُجد)";
                  })()}
                </option>

                {accounts
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.phoneNumber} — {item.providerName}
                      {item.isDefault ? " (افتراضي)" : ""}
                    </option>
                  ))}
              </select>
            </MessageField>

            <MessageField label="عدد المستلمين (تلقائي)">
              <input
                value={
                  isEdit
                    ? String(message?.recipientsCount ?? 1)
                    : recipientType === "groups" && estimatedRecipients === 0
                      ? String(selectedGroupIds.length)
                      : String(estimatedRecipients)
                }
                readOnly
                aria-label="عدد المستلمين"
                className="field cursor-default bg-slate-50 font-bold text-slate-700"
              />
            </MessageField>

            <div className="sm:col-span-2">
              <MessageField label="محتوى الرسالة">
                <textarea
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setError("");
                  }}
                  placeholder="اكتب محتوى الرسالة هنا..."
                  className="field min-h-32 resize-y"
                />
              </MessageField>
            </div>

            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                مرفق (صورة أو PDF — حتى 3MB)
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                aria-label="إرفاق صورة أو ملف"
                onChange={(event) => {
                  handleFileSelect(
                    event.target.files?.[0],
                  );
                }}
              />

              {!attachment ? (
                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={readingFile}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-xs font-semibold text-slate-600 transition hover:border-[#5EADEB] hover:bg-[#EEF3FF]/50 hover:text-[#10275B] disabled:cursor-wait disabled:opacity-60"
                >
                  <FiPaperclip size={15} />
                  {readingFile
                    ? "جاري قراءة الملف..."
                    : "إرفاق صورة أو ملف PDF"}
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-[#CAD6FF] bg-[#EEF3FF]/60 p-3">
                  {attachment.mime.startsWith("image/") &&
                  attachment.data ? (
                    <Image
                      src={attachment.data}
                      alt={attachment.name}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      <FiFileText size={20} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {attachment.name}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {(attachment.size / 1024).toFixed(0)} KB
                      {attachment.mime.startsWith("image/")
                        ? " • صورة"
                        : " • PDF"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    title="إزالة المرفق"
                    aria-label="إزالة المرفق"
                  >
                    <FiTrash2 size={15} />
                  </button>
                </div>
              )}

              {attachmentError && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600">
                  {attachmentError}
                </p>
              )}
            </div>

            <MessageField label="الحالة">
              <select
                value={status}
                onChange={(event) => {
                  const nextStatus =
                    event.target
                      .value as MessageStatus;

                  setStatus(nextStatus);

                  if (nextStatus === "draft") {
                    setDate("");
                    setTime("");
                  }

                  setError("");
                }}
                className="field"
              >
                <option value="draft">
                  مسودة
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="scheduled">
                  مجدولة
                </option>

                <option value="sent">
                  Sent
                </option>

                <option value="failed">
                  Failed
                </option>
              </select>
            </MessageField>

            <MessageField label="التاريخ (يوم / شهر / سنة)">
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError("");
                }}
                disabled={status === "draft"}
                lang="en-CA"
                className="field disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
              {date.trim() !== "" && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  التنسيق: <span className="font-bold text-slate-700" dir="ltr">{formatDateDMY(date)}</span> (DD/MM/YYYY)
                </p>
              )}
            </MessageField>

            <MessageField label="الوقت">
              <TimePicker
                value={time}
                onChange={(next) =>
                  setTime(next)
                }
                disabled={status === "draft"}
              />
            </MessageField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1748EF] px-5 text-sm font-semibold text-white transition hover:bg-[#10275B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiFileText size={15} />

            {isSaving
              ? "جاري الحفظ..."
              : isEdit
                ? "حفظ التعديلات"
                : "حفظ الرسالة"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_PROVIDERS = [
  "ultramsg",
  "wati",
  "360dialog",
  "twilio",
  "custom",
] as const;

function AccountModal({
  open,
  account,
  onClose,
  onSubmit,
}: {
  open: boolean;
  account: WhatsAppAccount | null;
  onClose: () => void;
  onSubmit: (data: {
    phoneNumber: string;
    providerName: string;
    apiUrl: string;
    apiToken?: string;
    isDefault: boolean;
    status: "active" | "inactive";
  }) => void | Promise<void>;
}) {
  const isEdit = Boolean(account);

  const [phoneNumber, setPhoneNumber] = useState(
    account?.phoneNumber ?? "",
  );
  const [providerName, setProviderName] = useState(
    account?.providerName ?? "ultramsg",
  );
  const [apiUrl, setApiUrl] = useState(account?.apiUrl ?? "");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isDefault, setIsDefault] = useState(
    account?.isDefault ?? false,
  );
  const [status, setStatus] = useState<"active" | "inactive">(
    account?.status ?? "active",
  );

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (phoneNumber.trim().length < 8) {
      setError("رقم هاتف المرسل يجب أن يكون 8 أرقام على الأقل.");
      return;
    }
    if (!apiUrl.trim()) {
      setError("رابط الـ API مطلوب.");
      return;
    }
    try {
      new URL(apiUrl.trim());
    } catch {
      setError("رابط الـ API غير صالح.");
      return;
    }
    if (!isEdit && !apiToken.trim()) {
      setError("مفتاح الـ API مطلوب للحساب الجديد.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSubmit({
        phoneNumber: phoneNumber.trim(),
        providerName: providerName.trim() || "custom",
        apiUrl: apiUrl.trim(),
        apiToken: apiToken.trim() || undefined,
        isDefault,
        status,
      });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.statusCode === 403
            ? "لا تملك صلاحية إدارة الحسابات (مطلوب حساب مدير)."
            : submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "تعذر حفظ الحساب.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? "تعديل حساب الإرسال" : "إضافة حساب إرسال"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              بيانات بوابة الواتساب — تُستخدم ديناميكياً عند
              الإرسال بدل متغيرات .env.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-180px)] flex-1 overflow-y-auto p-5">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <MessageField label="رقم هاتف المرسل *">
              <input
                dir="ltr"
                value={phoneNumber}
                onChange={(event) => {
                  setPhoneNumber(event.target.value);
                  setError("");
                }}
                placeholder="01xxxxxxxxx"
                inputMode="tel"
                className="field text-left"
              />
            </MessageField>

            <MessageField label="البوابة">
              <select
                value={providerName}
                onChange={(event) => {
                  setProviderName(event.target.value);
                  setError("");
                }}
                className="field"
              >
                {ACCOUNT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </MessageField>

            <div className="sm:col-span-2">
              <MessageField label="رابط الـ API *">
                <input
                  dir="ltr"
                  value={apiUrl}
                  onChange={(event) => {
                    setApiUrl(event.target.value);
                    setError("");
                  }}
                  placeholder="https://api.ultramsg.com/instance.../messages/chat"
                  inputMode="url"
                  className="field text-left"
                />
              </MessageField>
            </div>

            <div className="sm:col-span-2">
              <MessageField
                label={
                  isEdit
                    ? "مفتاح الـ API (اتركه فارغاً للإبقاء)"
                    : "مفتاح الـ API *"
                }
              >
                <div className="relative">
                  <input
                    dir="ltr"
                    type={showToken ? "text" : "password"}
                    value={apiToken}
                    onChange={(event) => {
                      setApiToken(event.target.value);
                      setError("");
                    }}
                    placeholder={isEdit ? "••••••••" : "الصق المفتاح هنا"}
                    autoComplete="off"
                    className="field pl-11 text-left"
                  />

                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showToken ? "إخفاء" : "إظهار"}
                  >
                    {showToken ? (
                      <FiEyeOff size={16} />
                    ) : (
                      <FiEye size={16} />
                    )}
                  </button>
                </div>
              </MessageField>
            </div>

            <MessageField label="الحالة">
              <select
                value={status}
                onChange={(event) => {
                  setStatus(
                    event.target.value as "active" | "inactive",
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </MessageField>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) =>
                  setIsDefault(event.target.checked)
                }
                className="h-4 w-4 shrink-0 accent-[#1748EF]"
              />

              <span className="text-xs font-semibold text-slate-700">
                تعيين كمرسل افتراضي
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1748EF] px-5 text-sm font-semibold text-white transition hover:bg-[#10275B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiCheckCircle size={15} />
            {isSaving
              ? "جاري الحفظ..."
              : isEdit
                ? "حفظ التعديلات"
                : "إضافة الحساب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountTestModal({
  account,
  onClose,
}: {
  account: WhatsAppAccount | null;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [result, setResult] =
    useState<WhatsAppTestResult | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!account) return null;

  const handleTest = async () => {
    if (phone.trim().length < 8) {
      setError("أدخل رقم هاتف حقيقي للاختبار (8 أرقام على الأقل).");
      return;
    }

    setIsSending(true);
    setError("");
    setResult(null);
    try {
      const res = await whatsappAccountService.test(
        account.id,
        phone.trim(),
      );
      setResult(res);
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "تعذر تنفيذ الاختبار.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              اختبار الاتصال
            </h2>

            <p className="mt-1 text-xs text-slate-500" dir="ltr">
              {account.phoneNumber} ({account.providerName})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          <MessageField label="رقم الهاتف المستلم *">
            <input
              dir="ltr"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError("");
              }}
              placeholder="01xxxxxxxxx"
              inputMode="tel"
              className="field text-left"
            />
          </MessageField>

          {result && (
            <div
              className={[
                "mt-4 rounded-xl border p-3 text-xs leading-6",
                result.success
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-red-100 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {result.success ? (
                <p className="font-bold">
                  تم الإرسال بنجاح
                  {result.messageId
                    ? ` (id: ${result.messageId})`
                    : ""}
                </p>
              ) : (
                <p>
                  <span className="font-bold">فشل الاختبار: </span>
                  {result.error ?? "خطأ غير معروف"}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={isSending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1748EF] px-5 text-sm font-semibold text-white transition hover:bg-[#10275B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSend size={15} />
              {isSending ? "جاري الإرسال..." : "إرسال اختبار"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      {children}
    </label>
  );
}
