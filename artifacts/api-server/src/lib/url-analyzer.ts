import { logger } from "./logger";

export interface UrlCheckResult {
  url: string;
  type: "github" | "portfolio" | "other";
  accessible: boolean;
  statusCode?: number;
  githubData?: GitHubData;
  technicalAnalysis?: string;
}

export interface GitHubData {
  login: string;
  name: string | null;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  topLanguages: string[];
  pinnedRepos?: PinnedRepo[];
  totalStars: number;
  accountAge: string;
}

interface PinnedRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\)\]\}"'<>，。、]+/gi;
  const found = text.match(urlRegex) ?? [];
  // Deduplicate and clean trailing punctuation
  return [...new Set(found.map(u => u.replace(/[.,;:!?]+$/, "")))];
}

export function classifyUrl(url: string): "github" | "portfolio" | "other" {
  if (/github\.com\//i.test(url)) return "github";
  if (/gitlab\.com|bitbucket\.org|codepen\.io|codesandbox\.io|vercel\.app|netlify\.app|dev\.to|velog\.io|tistory\.com|notion\.so/i.test(url)) return "portfolio";
  return "other";
}

async function checkAccessible(url: string): Promise<{ accessible: boolean; statusCode?: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ResumeAnalyzer/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    return { accessible: resp.ok || resp.status === 405, statusCode: resp.status };
  } catch {
    return { accessible: false };
  }
}

async function fetchGitHubData(url: string): Promise<GitHubData | null> {
  try {
    // Parse GitHub URL: github.com/username or github.com/username/repo
    const match = url.match(/github\.com\/([^/\s]+)(?:\/([^/\s]+))?/i);
    if (!match) return null;

    const username = match[1];
    if (["login", "pricing", "about", "explore", "topics", "trending"].includes(username.toLowerCase())) return null;

    const headers: Record<string, string> = {
      "User-Agent": "ResumeAnalyzer/1.0",
      "Accept": "application/vnd.github+json",
    };

    const userResp = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!userResp.ok) return null;
    const user = await userResp.json() as {
      login: string; name: string | null; bio: string | null;
      public_repos: number; followers: number; following: number;
      created_at: string;
    };

    // Get repos sorted by stars
    const reposResp = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=30&type=owner`,
      { headers }
    );
    const repos = reposResp.ok ? (await reposResp.json() as {
      name: string; description: string | null; language: string | null;
      stargazers_count: number; fork: boolean;
    }[]).filter(r => !r.fork) : [];

    // Count languages
    const langCount: Record<string, number> = {};
    for (const r of repos) {
      if (r.language) langCount[r.language] = (langCount[r.language] ?? 0) + 1;
    }
    const topLanguages = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);

    const pinnedRepos: PinnedRepo[] = repos
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map(r => ({ name: r.name, description: r.description, language: r.language, stars: r.stargazers_count }));

    // Account age
    const createdYear = new Date(user.created_at).getFullYear();
    const nowYear = new Date().getFullYear();
    const accountAge = `${nowYear - createdYear}년 경력`;

    return {
      login: user.login,
      name: user.name,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      topLanguages,
      pinnedRepos,
      totalStars,
      accountAge,
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch GitHub data");
    return null;
  }
}

export async function analyzeUrls(urls: string[]): Promise<UrlCheckResult[]> {
  const results: UrlCheckResult[] = [];
  const seen = new Set<string>();

  // Process up to 8 URLs to avoid timeout
  const targetUrls = urls.slice(0, 8);

  await Promise.all(
    targetUrls.map(async (url) => {
      if (seen.has(url)) return;
      seen.add(url);

      const type = classifyUrl(url);
      const { accessible, statusCode } = await checkAccessible(url);

      let githubData: GitHubData | undefined;
      let technicalAnalysis: string | undefined;

      if (type === "github" && accessible) {
        const data = await fetchGitHubData(url);
        if (data) {
          githubData = data;
          technicalAnalysis = buildGitHubAnalysis(data);
        }
      }

      results.push({ url, type, accessible, statusCode, githubData, technicalAnalysis });
    })
  );

  return results;
}

function buildGitHubAnalysis(data: GitHubData): string {
  const lines: string[] = [];
  lines.push(`GitHub 계정: @${data.login} (${data.accountAge})`);
  if (data.name) lines.push(`이름: ${data.name}`);
  if (data.bio) lines.push(`소개: ${data.bio}`);
  lines.push(`공개 저장소: ${data.publicRepos}개 | 팔로워: ${data.followers}명 | 총 스타: ${data.totalStars}`);
  if (data.topLanguages.length > 0) {
    lines.push(`주요 사용 언어: ${data.topLanguages.join(", ")}`);
  }
  if (data.pinnedRepos && data.pinnedRepos.length > 0) {
    lines.push("주요 프로젝트:");
    for (const repo of data.pinnedRepos) {
      const star = repo.stars > 0 ? ` ⭐${repo.stars}` : "";
      const lang = repo.language ? ` [${repo.language}]` : "";
      lines.push(`  - ${repo.name}${lang}${star}: ${repo.description ?? "(설명 없음)"}`);
    }
  }
  return lines.join("\n");
}

export function formatUrlAnalysisForPrompt(results: UrlCheckResult[]): string {
  if (results.length === 0) return "이력서에서 URL이 발견되지 않았습니다.";

  const lines: string[] = ["[URL/링크 분석 결과]"];
  for (const r of results) {
    const status = r.accessible ? `접근 가능 (HTTP ${r.statusCode ?? "OK"})` : "접근 불가 (오류 또는 없는 페이지)";
    lines.push(`\n• ${r.url}`);
    lines.push(`  유형: ${r.type === "github" ? "GitHub" : r.type === "portfolio" ? "포트폴리오/블로그" : "기타"} | 상태: ${status}`);
    if (r.technicalAnalysis) {
      lines.push(`  ${r.technicalAnalysis.split("\n").join("\n  ")}`);
    }
  }
  return lines.join("\n");
}
