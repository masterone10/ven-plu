export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          product_payment_method: Database["public"]["Enums"]["payment_method"];
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          product_payment_method?: Database["public"]["Enums"]["payment_method"];
          quantity?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          product_payment_method?: Database["public"]["Enums"]["payment_method"];
          quantity?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          delivery_points_reward: number;
          id: string;
          line_cash_total: number;
          line_points_total: number;
          order_id: string;
          product_id: string | null;
          product_name_ar: string;
          product_name_en: string;
          product_payment_method: Database["public"]["Enums"]["payment_method"];
          quantity: number;
          sku: string;
          unit_cash_price: number;
          unit_points_price: number;
          variant_id: string | null;
          variant_name_ar: string;
          variant_name_en: string;
        };
        Insert: {
          created_at?: string;
          delivery_points_reward?: number;
          id?: string;
          line_cash_total?: number;
          line_points_total?: number;
          order_id: string;
          product_id?: string | null;
          product_name_ar: string;
          product_name_en: string;
          product_payment_method: Database["public"]["Enums"]["payment_method"];
          quantity: number;
          sku: string;
          unit_cash_price?: number;
          unit_points_price?: number;
          variant_id?: string | null;
          variant_name_ar: string;
          variant_name_en: string;
        };
        Update: {
          created_at?: string;
          delivery_points_reward?: number;
          id?: string;
          line_cash_total?: number;
          line_points_total?: number;
          order_id?: string;
          product_id?: string | null;
          product_name_ar?: string;
          product_name_en?: string;
          product_payment_method?: Database["public"]["Enums"]["payment_method"];
          quantity?: number;
          sku?: string;
          unit_cash_price?: number;
          unit_points_price?: number;
          variant_id?: string | null;
          variant_name_ar?: string;
          variant_name_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancelled_at: string | null;
          cash_total: number;
          confirmed_at: string | null;
          created_at: string;
          created_by_admin: string | null;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          expected_delivery_duration: string | null;
          funding_mode: Database["public"]["Enums"]["order_funding_mode"];
          id: string;
          idempotency_fingerprint: string | null;
          idempotency_key: string;
          order_number: string;
          points_refunded: boolean;
          points_total: number;
          purchase_reward_granted: boolean;
          referral_reward_granted: boolean;
          shipping_address: Json;
          shipping_cash_price: number;
          shipping_payment_method: Database["public"]["Enums"]["payment_method"];
          shipping_points_price: number;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          cancelled_at?: string | null;
          cash_total?: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by_admin?: string | null;
          customer_name: string;
          customer_phone: string;
          delivered_at?: string | null;
          expected_delivery_duration?: string | null;
          funding_mode: Database["public"]["Enums"]["order_funding_mode"];
          id?: string;
          idempotency_fingerprint?: string | null;
          idempotency_key: string;
          order_number?: string;
          points_refunded?: boolean;
          points_total?: number;
          purchase_reward_granted?: boolean;
          referral_reward_granted?: boolean;
          shipping_address?: Json;
          shipping_cash_price?: number;
          shipping_payment_method: Database["public"]["Enums"]["payment_method"];
          shipping_points_price?: number;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          cancelled_at?: string | null;
          cash_total?: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by_admin?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          expected_delivery_duration?: string | null;
          funding_mode?: Database["public"]["Enums"]["order_funding_mode"];
          id?: string;
          idempotency_fingerprint?: string | null;
          idempotency_key?: string;
          order_number?: string;
          points_refunded?: boolean;
          points_total?: number;
          purchase_reward_granted?: boolean;
          referral_reward_granted?: boolean;
          shipping_address?: Json;
          shipping_cash_price?: number;
          shipping_payment_method?: Database["public"]["Enums"]["payment_method"];
          shipping_points_price?: number;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      points_balances: {
        Row: {
          balance: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      points_transactions: {
        Row: {
          created_at: string;
          delta: number;
          id: string;
          idempotency_key: string;
          note: string | null;
          order_id: string | null;
          related_transaction_id: string | null;
          source_reference: string | null;
          type: Database["public"]["Enums"]["points_transaction_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          delta: number;
          id?: string;
          idempotency_key: string;
          note?: string | null;
          order_id?: string | null;
          related_transaction_id?: string | null;
          source_reference?: string | null;
          type: Database["public"]["Enums"]["points_transaction_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          delta?: number;
          id?: string;
          idempotency_key?: string;
          note?: string | null;
          order_id?: string | null;
          related_transaction_id?: string | null;
          source_reference?: string | null;
          type?: Database["public"]["Enums"]["points_transaction_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "points_transactions_order_fk";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "points_transactions_related_transaction_id_fkey";
            columns: ["related_transaction_id"];
            isOneToOne: false;
            referencedRelation: "points_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_ar: string | null;
          alt_en: string | null;
          created_at: string;
          id: string;
          is_primary: boolean;
          product_id: string;
          sort_order: number;
          url: string;
          variant_id: string | null;
        };
        Insert: {
          alt_ar?: string | null;
          alt_en?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id: string;
          sort_order?: number;
          url: string;
          variant_id?: string | null;
        };
        Update: {
          alt_ar?: string | null;
          alt_en?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id?: string;
          sort_order?: number;
          url?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          cash_price: number | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string;
          points_price: number | null;
          product_id: string;
          sku: string;
          stock: number;
          updated_at: string;
        };
        Insert: {
          cash_price?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en: string;
          points_price?: number | null;
          product_id: string;
          sku: string;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          cash_price?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string;
          points_price?: number | null;
          product_id?: string;
          sku?: string;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          cash_price: number;
          category_id: string | null;
          created_at: string;
          default_points_price: number | null;
          delivery_points_reward: number;
          description_ar: string | null;
          description_en: string | null;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string;
          points_enabled: boolean;
          slug: string;
          updated_at: string;
        };
        Insert: {
          cash_price: number;
          category_id?: string | null;
          created_at?: string;
          default_points_price?: number | null;
          delivery_points_reward?: number;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en: string;
          points_enabled?: boolean;
          slug: string;
          updated_at?: string;
        };
        Update: {
          cash_price?: number;
          category_id?: string | null;
          created_at?: string;
          default_points_price?: number | null;
          delivery_points_reward?: number;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string;
          points_enabled?: boolean;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          locale: string;
          phone: string | null;
          referral_code: string;
          referred_by: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          locale?: string;
          phone?: string | null;
          referral_code: string;
          referred_by?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          locale?: string;
          phone?: string | null;
          referral_code?: string;
          referred_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey";
            columns: ["referred_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          expected_delivery_duration: string;
          free_shipping_points_threshold: number;
          global_shipping_price: number;
          id: boolean;
          shipping_points_price: number;
          updated_at: string;
        };
        Insert: {
          expected_delivery_duration?: string;
          free_shipping_points_threshold?: number;
          global_shipping_price?: number;
          id?: boolean;
          shipping_points_price?: number;
          updated_at?: string;
        };
        Update: {
          expected_delivery_duration?: string;
          free_shipping_points_threshold?: number;
          global_shipping_price?: number;
          id?: boolean;
          shipping_points_price?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_delivery_rewards: {
        Args: { _order_id: string };
        Returns: {
          purchase_points: number;
          referral_points: number;
        }[];
      };
      apply_points_transaction: {
        Args: {
          _delta: number;
          _idempotency_key: string;
          _note?: string;
          _order_id?: string;
          _related_transaction_id?: string;
          _source_reference?: string;
          _type: Database["public"]["Enums"]["points_transaction_type"];
          _user_id: string;
        };
        Returns: {
          balance: number;
          created: boolean;
          transaction_id: string;
        }[];
      };
      cancel_order_with_compensation: {
        Args: { _actor_id: string; _order_id: string };
        Returns: {
          cancelled_order_id: string;
          refunded_points: number;
        }[];
      };
      checkout_place_order: {
        Args: {
          _customer_name: string;
          _customer_phone: string;
          _fingerprint: string;
          _idempotency_key: string;
          _shipping_address: Json;
          _shipping_payment_method: Database["public"]["Enums"]["payment_method"];
          _user_id: string;
        };
        Returns: {
          created: boolean;
          order_id: string;
          order_number: string;
        }[];
      };
      generate_referral_code: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      referral_code_exists: { Args: { _code: string }; Returns: boolean };
    };
    Enums: {
      app_role: "CUSTOMER" | "ADMIN";
      order_funding_mode: "CASH_ONLY" | "POINTS_ONLY" | "MIXED";
      order_status:
        "PENDING_CONFIRMATION" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
      payment_method: "CASH" | "POINTS";
      points_transaction_type:
        | "EARN_PURCHASE"
        | "EARN_REFERRAL"
        | "REDEEM_PRODUCT"
        | "REDEEM_SHIPPING"
        | "REFUND_PRODUCT_REDEMPTION"
        | "REFUND_SHIPPING_REDEMPTION"
        | "ADJUSTMENT_CREDIT"
        | "ADJUSTMENT_DEBIT";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["CUSTOMER", "ADMIN"],
      order_funding_mode: ["CASH_ONLY", "POINTS_ONLY", "MIXED"],
      order_status: [
        "PENDING_CONFIRMATION",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_method: ["CASH", "POINTS"],
      points_transaction_type: [
        "EARN_PURCHASE",
        "EARN_REFERRAL",
        "REDEEM_PRODUCT",
        "REDEEM_SHIPPING",
        "REFUND_PRODUCT_REDEMPTION",
        "REFUND_SHIPPING_REDEMPTION",
        "ADJUSTMENT_CREDIT",
        "ADJUSTMENT_DEBIT",
      ],
    },
  },
} as const;
