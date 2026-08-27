import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "ar" | "en";

const STORAGE_KEY = "venplus.locale";

type Dict = Record<string, { ar: string; en: string }>;

const dict: Dict = {
  brand: { ar: "فين بلس", en: "VEN+" },
  tagline: {
    ar: "متجر ونقاط في مكان واحد — الدفع كاش أو بالنقاط",
    en: "Shop and points in one place — pay with cash or with points",
  },
  heroBody: {
    ar: "اكسب نقاطًا مع كل عملية شراء تُسلَّم، واستبدلها بالمنتجات أو بالشحن. الأسعار بالجنيه المصري.",
    en: "Earn points on every delivered order and redeem them for products or shipping. Prices in EGP.",
  },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signUp: { ar: "إنشاء حساب", en: "Create account" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  account: { ar: "حسابي", en: "My account" },
  products: { ar: "المنتجات", en: "Products" },
  cart: { ar: "السلة", en: "Cart" },
  checkout: { ar: "إتمام الطلب", en: "Checkout" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  phone: { ar: "رقم الهاتف", en: "Phone number" },
  referralCode: { ar: "كود الإحالة (اختياري)", en: "Referral code (optional)" },
  forgotPassword: { ar: "نسيت كلمة المرور؟", en: "Forgot password?" },
  resetPassword: { ar: "إعادة تعيين كلمة المرور", en: "Reset password" },
  continueWithGoogle: { ar: "المتابعة باستخدام Google", en: "Continue with Google" },
  pointsBalance: { ar: "رصيد النقاط", en: "Points balance" },
  pointsHistory: { ar: "سجل النقاط", en: "Points history" },
  myReferralCode: { ar: "كود الإحالة الخاص بك", en: "Your referral code" },
  referralHint: {
    ar: "يحصل حسابك على 50 نقطة عند أول طلب يُسلَّم لمن يستخدم كودك.",
    en: "You get 50 points when someone who used your code has their first order delivered.",
  },
  profile: { ar: "الملف الشخصي", en: "Profile" },
  save: { ar: "حفظ", en: "Save" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  language: { ar: "English", en: "العربية" },
  theme: { ar: "الوضع الليلي", en: "Dark mode" },
  points: { ar: "نقطة", en: "points" },
  noPointsYet: { ar: "لا توجد حركات نقاط بعد.", en: "No points activity yet." },
  shipping: { ar: "الشحن", en: "Shipping" },
  freeShippingThreshold: {
    ar: "حد الشحن بالنقاط",
    en: "Points shipping threshold",
  },
  expectedDelivery: { ar: "مدة التسليم المتوقعة", en: "Expected delivery" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  authGenericNotice: {
    ar: "إذا كان البريد الإلكتروني صحيحًا فسوف تصل رسالة بالخطوات التالية.",
    en: "If that email is valid, a message with the next steps has been sent.",
  },
  checkInbox: {
    ar: "تحقق من بريدك لتأكيد الحساب.",
    en: "Check your inbox to confirm your account.",
  },
  earnPurchase: { ar: "نقاط شراء", en: "Purchase reward" },
  earnReferral: { ar: "مكافأة إحالة", en: "Referral reward" },
  redeemProduct: { ar: "استبدال منتج", en: "Product redemption" },
  redeemShipping: { ar: "استبدال شحن", en: "Shipping redemption" },
  refundProduct: { ar: "استرجاع نقاط منتج", en: "Product redemption refund" },
  refundShipping: { ar: "استرجاع نقاط شحن", en: "Shipping redemption refund" },
  adjustmentCredit: { ar: "تسوية إضافة", en: "Adjustment credit" },
  adjustmentDebit: { ar: "تسوية خصم", en: "Adjustment debit" },
  orders: { ar: "طلباتي", en: "My orders" },
  adminProducts: { ar: "إدارة المنتجات", en: "Products admin" },
  resendConfirmation: { ar: "إعادة إرسال رابط التأكيد", en: "Resend confirmation email" },
  newPassword: { ar: "كلمة المرور الجديدة", en: "New password" },
  confirmNewPassword: { ar: "تأكيد كلمة المرور الجديدة", en: "Confirm new password" },
  updatePassword: { ar: "تحديث كلمة المرور", en: "Update password" },
  passwordUpdated: {
    ar: "تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
    en: "Password updated successfully. You can now sign in.",
  },
  passwordMismatch: { ar: "كلمتا المرور غير متطابقتين.", en: "Passwords do not match." },
  resendNotice: {
    ar: "إذا كان الحساب مسجلاً وغير مؤكد، تم إرسال رابط تأكيد جديد.",
    en: "If the account exists and is unconfirmed, a new confirmation link has been sent.",
  },
  accountConfirmed: {
    ar: "تم تأكيد حسابك بنجاح! يمكنك الآن تسجيل الدخول.",
    en: "Your account has been confirmed! You can now sign in.",
  },
  backToSignIn: { ar: "العودة لتسجيل الدخول", en: "Back to sign in" },
  forgotPasswordDescription: {
    ar: "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.",
    en: "Enter your email address and we will send you a password reset link.",
  },
  resendDescription: {
    ar: "أدخل بريدك الإلكتروني لإعادة إرسال رابط تفعيل الحساب.",
    en: "Enter your email address to receive a new account confirmation link.",
  },
  sendResetLink: { ar: "إرسال رابط الاستعادة", en: "Send reset link" },
  sendConfirmationLink: { ar: "إرسال رابط التأكيد", en: "Send confirmation link" },
  shippingSettings: { ar: "إعدادات الشحن", en: "Shipping settings" },
  cashShippingPrice: { ar: "سعر الشحن كاش (ج.م)", en: "Cash shipping price (EGP)" },
  pointsShippingPrice: { ar: "سعر الشحن بالنقاط", en: "Points shipping price" },
  expectedDeliveryDuration: { ar: "مدة التوصيل المتوقعة", en: "Expected delivery duration" },
  shippingMethod: { ar: "طريقة دفع الشحن", en: "Shipping payment method" },
  cashFreeWithPoints: { ar: "مجاني كاش (خصم نقاط)", en: "Cash-free (points redemption)" },
  saveShippingSettings: { ar: "حفظ إعدادات الشحن", en: "Save shipping settings" },
  shippingSettingsSaved: {
    ar: "تم حفظ إعدادات الشحن بنجاح",
    en: "Shipping settings saved successfully",
  },
};

const ledgerLabels: Record<string, keyof typeof dict> = {
  EARN_PURCHASE: "earnPurchase",
  EARN_REFERRAL: "earnReferral",
  REDEEM_PRODUCT: "redeemProduct",
  REDEEM_SHIPPING: "redeemShipping",
  REFUND_PRODUCT_REDEMPTION: "refundProduct",
  REFUND_SHIPPING_REDEMPTION: "refundShipping",
  ADJUSTMENT_CREDIT: "adjustmentCredit",
  ADJUSTMENT_DEBIT: "adjustmentDebit",
};

type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: keyof typeof dict) => string;
  ledgerLabel: (type: string) => string;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  formatEGP: (amount: number) => string;
  formatPoints: (points: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: keyof typeof dict) => dict[key]?.[locale] ?? String(key);
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t,
      ledgerLabel: (type: string) => {
        const key = ledgerLabels[type];
        return key ? t(key) : type;
      },
      setLocale,
      toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
      formatEGP: (amount: number) =>
        new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
          style: "currency",
          currency: "EGP",
          maximumFractionDigits: 2,
        }).format(amount),
      formatPoints: (pointsValue: number) =>
        `${new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(pointsValue)} ${t("points")}`,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
