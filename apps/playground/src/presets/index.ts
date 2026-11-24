export type PresetId = "react-i18next" | "next-intl" | "react-intl";

export interface PlaygroundPreset {
  id: PresetId;
  name: string;
  badge: string;
  description: string;
  sourceFilePath: string;
  sourceCode: string;
  baseLocale: string;
  targetLocale: string;
  locales: Record<string, string>;
}

export const PLAYGROUND_PRESETS: Record<PresetId, PlaygroundPreset> = {
  "react-i18next": {
    id: "react-i18next",
    name: "react-i18next",
    badge: "Scoped Hooks + <Trans> + Dynamic",
    description:
      "Demonstrates lexical useTranslation('auth') scoping, aliased hooks, <Trans i18nKey>, dynamic template prefixes, plural linking, comment/URL safety, dead keys, and {{var}} interpolation mismatches.",
    sourceFilePath: "src/components/CheckoutPanel.tsx",
    baseLocale: "en",
    targetLocale: "fr",
    sourceCode: `import React from "react";
import { useTranslation, Trans } from "react-i18next";

// t('auth.commented_out_key')
/* t('common.block_comment_ignored') */
export function CheckoutPanel({
  user,
  count,
  errCode,
}: {
  user: string;
  count: number;
  errCode: string;
}) {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation(["common", "fallback"]);
  const docsUrl = "https://example.com/docs//i18n";

  return (
    <section className="p-6">
      <h2>{t("welcome_back", { user })}</h2>
      <p>{t("cart:items", { count })}</p>

      <Trans i18nKey="auth.terms_notice">
        By continuing, you agree to our <a href={docsUrl}>Terms</a>.
      </Trans>

      {/* Dynamic template prefix protects errors.* in locale JSON */}
      <div className="text-red-500">{t(\`common:errors.\${errCode}\`)}</div>

      <div className="flex gap-2">
        <button>{tCommon("save")}</button>
        <button>{t("forgot_password")}</button>
      </div>
    </section>
  );
}
`,
    locales: {
      en: `{
  "auth": {
    "welcome_back": "Welcome back, {{user}}!",
    "terms_notice": "By continuing, you agree to our <1>Terms</1>.",
    "legacy_v1_banner": "This key is unused and safe to prune"
  },
  "cart": {
    "items_one": "{{count}} item in your cart",
    "items_other": "{{count}} items in your cart"
  },
  "common": {
    "save": "Save changes",
    "unused_tooltip": "Orphaned tooltip from old UI",
    "errors": {
      "network": "Network connection lost",
      "timeout": "Request timed out"
    }
  }
}
`,
      fr: `{
  "auth": {
    "welcome_back": "Bon retour, {{username}} !",
    "legacy_v1_banner": "Clé inutilisée à supprimer"
  },
  "cart": {
    "items_one": "{{count}} article dans votre panier",
    "items_other": "{{counts}} articles dans votre panier"
  },
  "common": {
    "save": "Enregistrer les modifications",
    "unused_tooltip": "Info-bulle orpheline",
    "errors": {
      "network": "Connexion réseau perdue",
      "timeout": "Délai d'attente dépassé"
    }
  }
}
`,
    },
  },
  "next-intl": {
    id: "next-intl",
    name: "next-intl",
    badge: "App Router + useTranslations",
    description:
      "Demonstrates next-intl nested namespace scoping via useTranslations('Dashboard.Header'), ICU single-brace placeholders, missing target translations, and dead keys.",
    sourceFilePath: "app/[locale]/dashboard/Header.tsx",
    baseLocale: "en",
    targetLocale: "de",
    sourceCode: `import React from "react";
import { useTranslations } from "next-intl";

export function DashboardHeader({
  accountName,
  unreadCount,
  statusKey,
}: {
  accountName: string;
  unreadCount: number;
  statusKey: string;
}) {
  const t = useTranslations("Dashboard.Header");
  const tBilling = useTranslations("Dashboard.Billing");

  return (
    <header className="flex items-center justify-between">
      <h1>{t("greeting", { accountName })}</h1>
      <span>{t("notifications", { unreadCount })}</span>
      <span className="badge">{t(\`status.\${statusKey}\`)}</span>
      <a href="/billing">{tBilling("upgrade_cta")}</a>
      <button>{t("export_csv")}</button>
    </header>
  );
}
`,
    locales: {
      en: `{
  "Dashboard": {
    "Header": {
      "greeting": "Hello {accountName}, welcome to your workspace",
      "notifications": "{unreadCount, plural, =0 {No unread alerts} one {# unread alert} other {# unread alerts}}",
      "status": {
        "healthy": "All systems operational",
        "degraded": "Partial outage detected"
      },
      "deprecated_subhead": "Unused subtitle from 2024 redesign"
    },
    "Billing": {
      "upgrade_cta": "Upgrade to Pro",
      "old_coupon_label": "Unused promo code field"
    }
  }
}
`,
      de: `{
  "Dashboard": {
    "Header": {
      "greeting": "Hallo {account_name}, willkommen in Ihrem Arbeitsbereich",
      "status": {
        "healthy": "Alle Systeme betriebsbereit",
        "degraded": "Teilweiser Ausfall erkannt"
      },
      "deprecated_subhead": "Unbenutzter Untertitel"
    },
    "Billing": {
      "upgrade_cta": "Auf Pro upgraden",
      "old_coupon_label": "Unbenutztes Gutscheinfeld"
    }
  }
}
`,
    },
  },
  "react-intl": {
    id: "react-intl",
    name: "react-intl",
    badge: "<FormattedMessage> + useIntl",
    description:
      "Demonstrates FormatJS / react-intl <FormattedMessage id=\"...\"> and intl.formatMessage({ id }) AST extraction with ICU interpolation validation and format-preserving pruning.",
    sourceFilePath: "src/views/ProfileCard.tsx",
    baseLocale: "en",
    targetLocale: "es",
    sourceCode: `import React from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function ProfileCard({
  fullName,
  role,
  followerCount,
}: {
  fullName: string;
  role: string;
  followerCount: number;
}) {
  const intl = useIntl();

  const ariaTitle = intl.formatMessage(
    { id: "profile.avatar_alt" },
    { fullName }
  );

  return (
    <article aria-label={ariaTitle}>
      <h3>
        <FormattedMessage
          id="profile.headline"
          values={{ fullName, role }}
        />
      </h3>
      <p>
        <FormattedMessage
          id="profile.followers"
          values={{ followerCount }}
        />
      </p>
      <button>
        <FormattedMessage id="profile.follow_action" />
      </button>
    </article>
  );
}
`,
    locales: {
      en: `{
  "profile": {
    "avatar_alt": "Profile photo of {fullName}",
    "headline": "{fullName} — {role}",
    "followers": "Followed by {followerCount} developers",
    "unused_bio_placeholder": "Tell the community about yourself...",
    "legacy_social": {
      "myspace_handle": "Unused nested object that will be pruned completely"
    }
  }
}
`,
      es: `{
  "profile": {
    "avatar_alt": "Foto de perfil de {fullName}",
    "headline": "{fullName} — {userRole}",
    "unused_bio_placeholder": "Cuéntale a la comunidad sobre ti..."
  }
}
`,
    },
  },
};
