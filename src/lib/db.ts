import { PrismaClient } from "@prisma/client";
import { readStore, writeStore } from "./storage";

declare global {
  var prismaInstance: PrismaClient | undefined;
}

export const prisma =
  global.prismaInstance ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaInstance = prisma;
}

export const isPostgresConfigured = Boolean(process.env.DATABASE_URL);

export interface DbUser {
  id: string;
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt?: string | Date;
}

export interface DbSession {
  id: string;
  token: string;
  userId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

export interface DbFavorite {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lon: number;
  country?: string | null;
  addedAt: string;
}

export interface DbSearchHistory {
  id: string;
  userId: string;
  query: string;
  at: string;
}

export interface DbAlertPreference {
  id?: string;
  userId: string;
  heavyRain: boolean;
  thunderstorm: boolean;
  heatwave: boolean;
  flood: boolean;
  emailEnabled: boolean;
  email?: string | null;
  pushEnabled: boolean;
}

export interface DbCustomAlertRule {
  id: string;
  userId: string;
  name: string;
  metric: "temperature" | "windSpeed" | "rainfall" | "uvIndex" | "aqi";
  operator: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  durationHours: number;
  severity: "info" | "watch" | "warning" | "danger";
  enabled: boolean;
  createdAt: string;
}

export interface DbAlertHistoryItem {
  id: string;
  userId?: string | null;
  location: string;
  title: string;
  message: string;
  severity: string;
  kind: string;
  read: boolean;
  triggeredAt: string;
}

export interface DbDashboardLayout {
  id?: string;
  userId: string;
  visibleCards: string[];
  cardOrder: string[];
  tempUnit: "C" | "F";
  windUnit: "kmh" | "mph" | "ms";
}

export const UserRepository = {
  async findByUsername(username: string): Promise<DbUser | null> {
    if (isPostgresConfigured) {
      try {
        const u = await prisma.user.findUnique({ where: { username } });
        return u ? { ...u, id: u.id } : null;
      } catch (err) {
        console.warn("Postgres query failed, using storage fallback:", err);
      }
    }
    const users = readStore<Record<string, DbUser>>("users", {});
    return users[username] ?? null;
  },

  async findById(id: string): Promise<DbUser | null> {
    if (isPostgresConfigured) {
      try {
        const u = await prisma.user.findUnique({ where: { id } });
        return u ? { ...u, id: u.id } : null;
      } catch (err) {
        console.warn("Postgres query failed, using storage fallback:", err);
      }
    }
    const users = readStore<Record<string, DbUser>>("users", {});
    return Object.values(users).find((u) => u.id === id) ?? null;
  },

  async create(data: { username: string; email: string; salt: string; passwordHash: string }): Promise<DbUser> {
    if (isPostgresConfigured) {
      try {
        const u = await prisma.user.create({ data });
        return { ...u, id: u.id };
      } catch (err) {
        console.warn("Postgres create user failed, using storage fallback:", err);
      }
    }
    const users = readStore<Record<string, DbUser>>("users", {});
    const newUser: DbUser = {
      id: "usr_" + Math.random().toString(36).slice(2, 10),
      ...data,
      createdAt: new Date().toISOString(),
    };
    users[data.username] = newUser;
    writeStore("users", users);
    return newUser;
  },
};

export const SessionRepository = {
  async create(userId: string, username: string, token: string, maxAgeSeconds = 30 * 24 * 3600): Promise<DbSession> {
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
    if (isPostgresConfigured) {
      try {
        const s = await prisma.session.create({
          data: { token, userId, expiresAt },
        });
        return {
          id: s.id,
          token: s.token,
          userId: s.userId,
          username,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        };
      } catch (err) {
        console.warn("Postgres create session failed, using storage fallback:", err);
      }
    }
    const sessions = readStore<Record<string, DbSession>>("sessions", {});
    const session: DbSession = {
      id: "sess_" + Math.random().toString(36).slice(2, 10),
      token,
      userId,
      username,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    sessions[token] = session;
    writeStore("sessions", sessions);
    return session;
  },

  async findByToken(token: string): Promise<DbSession | null> {
    if (!token) return null;
    if (isPostgresConfigured) {
      try {
        const s = await prisma.session.findUnique({
          where: { token },
          include: { user: true },
        });
        if (s && s.expiresAt > new Date()) {
          return {
            id: s.id,
            token: s.token,
            userId: s.userId,
            username: s.user.username,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
          };
        }
        return null;
      } catch (err) {
        console.warn("Postgres find session failed, using storage fallback:", err);
      }
    }
    const sessions = readStore<Record<string, DbSession>>("sessions", {});
    const sess = sessions[token];
    if (!sess) return null;
    if (new Date(sess.expiresAt) < new Date()) {
      delete sessions[token];
      writeStore("sessions", sessions);
      return null;
    }
    return sess;
  },

  async delete(token: string): Promise<void> {
    if (!token) return;
    if (isPostgresConfigured) {
      try {
        await prisma.session.delete({ where: { token } });
        return;
      } catch (err) {
        console.warn("Postgres delete session failed, using storage fallback:", err);
      }
    }
    const sessions = readStore<Record<string, DbSession>>("sessions", {});
    delete sessions[token];
    writeStore("sessions", sessions);
  },
};

export const FavoritesRepository = {
  async get(userId: string): Promise<DbFavorite[]> {
    if (isPostgresConfigured) {
      try {
        const favs = await prisma.favoriteCity.findMany({
          where: { userId },
          orderBy: { addedAt: "desc" },
        });
        return favs.map((f) => ({
          id: f.id,
          userId: f.userId,
          name: f.name,
          lat: f.lat,
          lon: f.lon,
          country: f.country,
          addedAt: f.addedAt.toISOString(),
        }));
      } catch (err) {
        console.warn("Postgres get favorites failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbFavorite[]>>("favorites", {});
    return all[userId] ?? [];
  },

  async add(userId: string, fav: { name: string; lat: number; lon: number; country?: string | null }): Promise<DbFavorite[]> {
    if (isPostgresConfigured) {
      try {
        await prisma.favoriteCity.upsert({
          where: { userId_name: { userId, name: fav.name } },
          update: { lat: fav.lat, lon: fav.lon, country: fav.country },
          create: { userId, name: fav.name, lat: fav.lat, lon: fav.lon, country: fav.country },
        });
        return this.get(userId);
      } catch (err) {
        console.warn("Postgres add favorite failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbFavorite[]>>("favorites", {});
    const list = all[userId] ?? [];
    if (!list.some((item) => item.name === fav.name)) {
      list.unshift({
        id: "fav_" + Math.random().toString(36).slice(2, 10),
        userId,
        name: fav.name,
        lat: fav.lat,
        lon: fav.lon,
        country: fav.country ?? null,
        addedAt: new Date().toISOString(),
      });
      all[userId] = list;
      writeStore("favorites", all);
    }
    return list;
  },

  async remove(userId: string, name: string): Promise<DbFavorite[]> {
    if (isPostgresConfigured) {
      try {
        await prisma.favoriteCity.deleteMany({ where: { userId, name } });
        return this.get(userId);
      } catch (err) {
        console.warn("Postgres remove favorite failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbFavorite[]>>("favorites", {});
    const list = (all[userId] ?? []).filter((item) => item.name !== name);
    all[userId] = list;
    writeStore("favorites", all);
    return list;
  },
};

export const SearchHistoryRepository = {
  async get(userId: string): Promise<DbSearchHistory[]> {
    if (isPostgresConfigured) {
      try {
        const hist = await prisma.searchHistory.findMany({
          where: { userId },
          orderBy: { at: "desc" },
          take: 20,
        });
        return hist.map((h) => ({
          id: h.id,
          userId: h.userId,
          query: h.query,
          at: h.at.toISOString(),
        }));
      } catch (err) {
        console.warn("Postgres search history failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbSearchHistory[]>>("search-history", {});
    return all[userId] ?? [];
  },

  async add(userId: string, query: string): Promise<DbSearchHistory[]> {
    if (isPostgresConfigured) {
      try {
        await prisma.searchHistory.create({ data: { userId, query } });
        return this.get(userId);
      } catch (err) {
        console.warn("Postgres add history failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbSearchHistory[]>>("search-history", {});
    const list = (all[userId] ?? []).filter((item) => item.query.toLowerCase() !== query.toLowerCase());
    list.unshift({
      id: "sh_" + Math.random().toString(36).slice(2, 10),
      userId,
      query,
      at: new Date().toISOString(),
    });
    all[userId] = list.slice(0, 20);
    writeStore("search-history", all);
    return all[userId];
  },

  async clear(userId: string): Promise<void> {
    if (isPostgresConfigured) {
      try {
        await prisma.searchHistory.deleteMany({ where: { userId } });
        return;
      } catch (err) {
        console.warn("Postgres clear history failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbSearchHistory[]>>("search-history", {});
    all[userId] = [];
    writeStore("search-history", all);
  },
};

export const AlertPreferencesRepository = {
  async get(userId: string): Promise<DbAlertPreference> {
    const defaultPrefs: DbAlertPreference = {
      userId,
      heavyRain: true,
      thunderstorm: true,
      heatwave: true,
      flood: true,
      emailEnabled: false,
      email: "",
      pushEnabled: false,
    };
    if (isPostgresConfigured) {
      try {
        const pref = await prisma.alertPreference.findUnique({ where: { userId } });
        if (pref) return { ...pref, email: pref.email ?? "" };
      } catch (err) {
        console.warn("Postgres get preferences failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbAlertPreference>>("preferences", {});
    return all[userId] ?? defaultPrefs;
  },

  async save(userId: string, data: Partial<DbAlertPreference>): Promise<DbAlertPreference> {
    const current = await this.get(userId);
    const updated: DbAlertPreference = {
      ...current,
      ...data,
      userId,
    };
    if (isPostgresConfigured) {
      try {
        const res = await prisma.alertPreference.upsert({
          where: { userId },
          update: {
            heavyRain: updated.heavyRain,
            thunderstorm: updated.thunderstorm,
            heatwave: updated.heatwave,
            flood: updated.flood,
            emailEnabled: updated.emailEnabled,
            email: updated.email ?? null,
            pushEnabled: updated.pushEnabled,
          },
          create: {
            userId,
            heavyRain: updated.heavyRain,
            thunderstorm: updated.thunderstorm,
            heatwave: updated.heatwave,
            flood: updated.flood,
            emailEnabled: updated.emailEnabled,
            email: updated.email ?? null,
            pushEnabled: updated.pushEnabled,
          },
        });
        return { ...res, email: res.email ?? "" };
      } catch (err) {
        console.warn("Postgres save preferences failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbAlertPreference>>("preferences", {});
    all[userId] = updated;
    writeStore("preferences", all);
    return updated;
  },
};

export const CustomAlertRuleRepository = {
  async list(userId: string): Promise<DbCustomAlertRule[]> {
    if (isPostgresConfigured) {
      try {
        const rules = await prisma.customAlertRule.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        return rules.map((r) => ({
          ...r,
          metric: r.metric as DbCustomAlertRule["metric"],
          operator: r.operator as DbCustomAlertRule["operator"],
          severity: r.severity as DbCustomAlertRule["severity"],
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.warn("Postgres custom rules failed, using storage fallback:", err);
      }
    }
    const all = readStore<Record<string, DbCustomAlertRule[]>>("custom-rules", {});
    return all[userId] ?? [];
  },

  async listAllEnabled(): Promise<DbCustomAlertRule[]> {
    if (isPostgresConfigured) {
      try {
        const rules = await prisma.customAlertRule.findMany({
          where: { enabled: true },
        });
        return rules.map((r) => ({
          ...r,
          metric: r.metric as DbCustomAlertRule["metric"],
          operator: r.operator as DbCustomAlertRule["operator"],
          severity: r.severity as DbCustomAlertRule["severity"],
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.warn("Postgres list enabled rules failed:", err);
      }
    }
    const all = readStore<Record<string, DbCustomAlertRule[]>>("custom-rules", {});
    return Object.values(all)
      .flat()
      .filter((r) => r.enabled);
  },

  async create(rule: Omit<DbCustomAlertRule, "id" | "createdAt">): Promise<DbCustomAlertRule> {
    if (isPostgresConfigured) {
      try {
        const r = await prisma.customAlertRule.create({ data: rule });
        return {
          ...r,
          metric: r.metric as DbCustomAlertRule["metric"],
          operator: r.operator as DbCustomAlertRule["operator"],
          severity: r.severity as DbCustomAlertRule["severity"],
          createdAt: r.createdAt.toISOString(),
        };
      } catch (err) {
        console.warn("Postgres create custom rule failed:", err);
      }
    }
    const all = readStore<Record<string, DbCustomAlertRule[]>>("custom-rules", {});
    const list = all[rule.userId] ?? [];
    const newRule: DbCustomAlertRule = {
      ...rule,
      id: "rule_" + Math.random().toString(36).slice(2, 10),
      createdAt: new Date().toISOString(),
    };
    list.unshift(newRule);
    all[rule.userId] = list;
    writeStore("custom-rules", all);
    return newRule;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    if (isPostgresConfigured) {
      try {
        await prisma.customAlertRule.deleteMany({ where: { id, userId } });
        return true;
      } catch (err) {
        console.warn("Postgres delete custom rule failed:", err);
      }
    }
    const all = readStore<Record<string, DbCustomAlertRule[]>>("custom-rules", {});
    if (all[userId]) {
      all[userId] = all[userId].filter((r) => r.id !== id);
      writeStore("custom-rules", all);
      return true;
    }
    return false;
  },

  async toggle(userId: string, id: string, enabled: boolean): Promise<DbCustomAlertRule | null> {
    if (isPostgresConfigured) {
      try {
        const r = await prisma.customAlertRule.update({
          where: { id },
          data: { enabled },
        });
        return {
          ...r,
          metric: r.metric as DbCustomAlertRule["metric"],
          operator: r.operator as DbCustomAlertRule["operator"],
          severity: r.severity as DbCustomAlertRule["severity"],
          createdAt: r.createdAt.toISOString(),
        };
      } catch (err) {
        console.warn("Postgres toggle custom rule failed:", err);
      }
    }
    const all = readStore<Record<string, DbCustomAlertRule[]>>("custom-rules", {});
    const list = all[userId] ?? [];
    const item = list.find((r) => r.id === id);
    if (item) {
      item.enabled = enabled;
      writeStore("custom-rules", all);
      return item;
    }
    return null;
  },
};

export const AlertHistoryRepository = {
  async list(userId?: string): Promise<DbAlertHistoryItem[]> {
    if (isPostgresConfigured) {
      try {
        const items = await prisma.alertHistory.findMany({
          where: userId ? { userId } : {},
          orderBy: { triggeredAt: "desc" },
          take: 50,
        });
        return items.map((i) => ({
          ...i,
          triggeredAt: i.triggeredAt.toISOString(),
        }));
      } catch (err) {
        console.warn("Postgres alert history failed, using storage fallback:", err);
      }
    }
    const all = readStore<DbAlertHistoryItem[]>("alert-history", []);
    if (!userId) return all.slice(0, 50);
    return all.filter((a) => !a.userId || a.userId === userId).slice(0, 50);
  },

  async log(item: Omit<DbAlertHistoryItem, "id" | "read" | "triggeredAt">): Promise<DbAlertHistoryItem> {
    if (isPostgresConfigured) {
      try {
        const logged = await prisma.alertHistory.create({
          data: {
            ...item,
            userId: item.userId ?? null,
          },
        });
        return {
          ...logged,
          triggeredAt: logged.triggeredAt.toISOString(),
        };
      } catch (err) {
        console.warn("Postgres log alert failed, using storage fallback:", err);
      }
    }
    const all = readStore<DbAlertHistoryItem[]>("alert-history", []);
    const newItem: DbAlertHistoryItem = {
      ...item,
      id: "alert_" + Math.random().toString(36).slice(2, 10),
      read: false,
      triggeredAt: new Date().toISOString(),
    };
    all.unshift(newItem);
    writeStore("alert-history", all.slice(0, 100));
    return newItem;
  },

  async markAllRead(userId?: string): Promise<void> {
    if (isPostgresConfigured) {
      try {
        await prisma.alertHistory.updateMany({
          where: userId ? { userId, read: false } : { read: false },
          data: { read: true },
        });
        return;
      } catch (err) {
        console.warn("Postgres markAllRead failed:", err);
      }
    }
    const all = readStore<DbAlertHistoryItem[]>("alert-history", []);
    all.forEach((a) => {
      if (!userId || a.userId === userId) a.read = true;
    });
    writeStore("alert-history", all);
  },

  async clear(userId?: string): Promise<void> {
    if (isPostgresConfigured) {
      try {
        await prisma.alertHistory.deleteMany({
          where: userId ? { userId } : {},
        });
        return;
      } catch (err) {
        console.warn("Postgres clear history failed:", err);
      }
    }
    if (!userId) {
      writeStore("alert-history", []);
    } else {
      const all = readStore<DbAlertHistoryItem[]>("alert-history", []);
      writeStore("alert-history", all.filter((a) => a.userId && a.userId !== userId));
    }
  },
};

export const DEFAULT_VISIBLE_CARDS = [
  "overview",
  "timeline",
  "recommendations",
  "airQuality",
  "uvIndex",
  "visibility",
  "dewPoint",
  "pressure",
  "humidity",
  "wind",
  "sunriseSunset",
  "moonPhase",
];

export const DashboardLayoutRepository = {
  async get(userId: string): Promise<DbDashboardLayout> {
    const defaultLayout: DbDashboardLayout = {
      userId,
      visibleCards: DEFAULT_VISIBLE_CARDS,
      cardOrder: DEFAULT_VISIBLE_CARDS,
      tempUnit: "C",
      windUnit: "kmh",
    };
    if (isPostgresConfigured) {
      try {
        const layout = await prisma.dashboardLayout.findUnique({ where: { userId } });
        if (layout) {
          return {
            userId: layout.userId,
            visibleCards: JSON.parse(layout.visibleCards),
            cardOrder: JSON.parse(layout.cardOrder),
            tempUnit: layout.tempUnit as "C" | "F",
            windUnit: layout.windUnit as "kmh" | "mph" | "ms",
          };
        }
      } catch (err) {
        console.warn("Postgres get layout failed, using fallback:", err);
      }
    }
    const all = readStore<Record<string, DbDashboardLayout>>("dashboard-layouts", {});
    return all[userId] ?? defaultLayout;
  },

  async save(userId: string, data: Partial<DbDashboardLayout>): Promise<DbDashboardLayout> {
    const current = await this.get(userId);
    const updated: DbDashboardLayout = {
      ...current,
      ...data,
      userId,
    };
    if (isPostgresConfigured) {
      try {
        await prisma.dashboardLayout.upsert({
          where: { userId },
          update: {
            visibleCards: JSON.stringify(updated.visibleCards),
            cardOrder: JSON.stringify(updated.cardOrder),
            tempUnit: updated.tempUnit,
            windUnit: updated.windUnit,
          },
          create: {
            userId,
            visibleCards: JSON.stringify(updated.visibleCards),
            cardOrder: JSON.stringify(updated.cardOrder),
            tempUnit: updated.tempUnit,
            windUnit: updated.windUnit,
          },
        });
        return updated;
      } catch (err) {
        console.warn("Postgres save layout failed:", err);
      }
    }
    const all = readStore<Record<string, DbDashboardLayout>>("dashboard-layouts", {});
    all[userId] = updated;
    writeStore("dashboard-layouts", all);
    return updated;
  },
};
