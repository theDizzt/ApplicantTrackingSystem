import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  GREATEST_LOWER_BOUND,
  TraceMap,
  originalPositionFor,
} from '@jridgewell/trace-mapping';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'dist', 'public');
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const requiredSources = [
  'src/main.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/dropdown-menu.tsx',
];
const traceProbe = {
  source: 'src/main.tsx',
  marker: 'Job document checker root element was not found',
  originalColumnOffset: -1,
};

const sourcemapWarningPatterns = [
  /sourcemap.*(?:missing|not found|could not|couldn't|failed|unable)/i,
  /(?:missing|not found|could not|couldn't|failed|unable).*sourcemap/i,
  /can't resolve original location/i,
  /could not resolve original location/i,
];

function runProductionBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [viteBin, 'build', '--config', 'vite.config.ts'],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: process.env.PORT ?? '4173',
          BASE_PATH: process.env.BASE_PATH ?? '/',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let buildLog = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        const text = chunk.toString();
        buildLog += text;
        process.stdout.write(text);
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Production build exited with status ${code}.`));
        return;
      }
      resolve(buildLog);
    });
  });
}

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

function normalizeSource(source) {
  return source.replaceAll('\\', '/').replace(/[?#].*$/, '');
}

function findUniquePosition(content, marker, label) {
  const index = content.indexOf(marker);
  if (index === -1) {
    throw new Error(`${label} does not contain trace marker "${marker}".`);
  }
  if (content.indexOf(marker, index + marker.length) !== -1) {
    throw new Error(`${label} contains trace marker "${marker}" more than once.`);
  }

  const beforeMarker = content.slice(0, index);
  const lines = beforeMarker.split('\n');
  return {
    line: lines.length,
    column: lines.at(-1).length,
  };
}

export async function verifySourcemaps(
  buildLog,
  root = outputRoot,
  expectedSources = requiredSources,
  probe = traceProbe,
) {
  const warning = sourcemapWarningPatterns.find((pattern) =>
    pattern.test(buildLog),
  );
  if (warning) {
    throw new Error(
      `Production build emitted a sourcemap source-resolution warning (${warning}).`,
    );
  }

  const outputFiles = await findFiles(root);
  const javascriptFiles = outputFiles.filter(
    (file) => file.endsWith('.js') && !file.endsWith('.js.map'),
  );
  const mapFiles = outputFiles.filter((file) => file.endsWith('.js.map'));

  if (javascriptFiles.length === 0) {
    throw new Error('Production build did not emit any JavaScript bundles.');
  }
  if (mapFiles.length === 0) {
    throw new Error('Production build did not emit any JavaScript sourcemaps.');
  }

  const missingMaps = javascriptFiles.filter(
    (file) => !mapFiles.includes(`${file}.map`),
  );
  if (missingMaps.length > 0) {
    throw new Error(
      `JavaScript bundles are missing sourcemaps:\n${missingMaps
        .map((file) => `- ${path.relative(root, file)}`)
        .join('\n')}`,
    );
  }

  const referencedMaps = new Map();
  for (const javascriptFile of javascriptFiles) {
    const javascript = await readFile(javascriptFile, 'utf8');
    const match = javascript.match(
      /\/\/[#@]\s*sourceMappingURL=([^\s]+)\s*$/,
    );
    if (!match) {
      throw new Error(
        `${path.relative(root, javascriptFile)} does not reference its sourcemap.`,
      );
    }
    if (match[1].startsWith('data:')) {
      throw new Error(
        `${path.relative(root, javascriptFile)} uses an inline sourcemap instead of its emitted map file.`,
      );
    }

    const referencedMap = path.resolve(
      path.dirname(javascriptFile),
      decodeURIComponent(match[1].split(/[?#]/, 1)[0]),
    );
    if (
      referencedMap !== `${javascriptFile}.map` ||
      !mapFiles.includes(referencedMap)
    ) {
      throw new Error(
        `${path.relative(root, javascriptFile)} does not reference its adjacent emitted sourcemap.`,
      );
    }
    referencedMaps.set(referencedMap, javascript);
  }

  const sourceSets = await Promise.all(
    [...referencedMaps].map(async ([file, javascript]) => {
      let sourcemap;
      try {
        sourcemap = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        throw new Error(
          `Unable to parse ${path.relative(root, file)}: ${error.message}`,
        );
      }
      if (!Array.isArray(sourcemap.sources) || sourcemap.sources.length === 0) {
        throw new Error(
          `${path.relative(root, file)} has no original sources.`,
        );
      }
      if (
        typeof sourcemap.mappings !== 'string' ||
        !/[A-Za-z0-9+/]/.test(sourcemap.mappings)
      ) {
        throw new Error(`${path.relative(root, file)} has no mappings.`);
      }
      if (
        !Array.isArray(sourcemap.sourcesContent) ||
        sourcemap.sourcesContent.length !== sourcemap.sources.length
      ) {
        throw new Error(
          `${path.relative(root, file)} does not embed content for every original source.`,
        );
      }
      const normalizedSources = sourcemap.sources.map(normalizeSource);
      const probeSourceIndex = normalizedSources.findIndex(
        (source) =>
          source === probe.source || source.endsWith(`/${probe.source}`),
      );
      const generatedHasProbe = javascript.includes(probe.marker);

      if (generatedHasProbe && probeSourceIndex === -1) {
        throw new Error(
          `${path.relative(root, file)} contains the trace marker but not its expected source ${probe.source}.`,
        );
      }
      if (generatedHasProbe) {
        const originalContent = sourcemap.sourcesContent[probeSourceIndex];
        if (typeof originalContent !== 'string') {
          throw new Error(
            `${path.relative(root, file)} does not embed the trace probe source content.`,
          );
        }

        const generatedPosition = findUniquePosition(
          javascript,
          probe.marker,
          path.relative(root, `${file.slice(0, -4)}`),
        );
        const expectedPosition = findUniquePosition(
          originalContent,
          probe.marker,
          probe.source,
        );
        expectedPosition.column += probe.originalColumnOffset ?? 0;
        let originalPosition;
        try {
          originalPosition = originalPositionFor(new TraceMap(sourcemap), {
            ...generatedPosition,
            bias: GREATEST_LOWER_BOUND,
          });
        } catch (error) {
          throw new Error(
            `${path.relative(root, file)} has unusable mappings: ${error.message}`,
          );
        }
        const mappedSource = originalPosition.source
          ? normalizeSource(originalPosition.source)
          : null;
        if (
          !mappedSource ||
          !(
            mappedSource === probe.source ||
            mappedSource.endsWith(`/${probe.source}`)
          ) ||
          originalPosition.line !== expectedPosition.line ||
          originalPosition.column !== expectedPosition.column
        ) {
          throw new Error(
            `${path.relative(root, file)} trace marker mapped to ${mappedSource ?? 'no source'}:${originalPosition.line ?? 'null'}:${originalPosition.column ?? 'null'} instead of ${probe.source}:${expectedPosition.line}:${expectedPosition.column}.`,
          );
        }
      }

      return sourcemap.sources.map((source, index) => ({
        path: normalizeSource(source),
        content: sourcemap.sourcesContent[index],
        containsTraceProbe: generatedHasProbe,
      }));
    }),
  );
  const allSources = sourceSets.flat();
  if (!allSources.some((source) => source.containsTraceProbe)) {
    throw new Error(
      `No JavaScript bundle contains trace marker "${probe.marker}".`,
    );
  }
  const missingSources = expectedSources.filter(
    (required) =>
      !allSources.some(
        (source) =>
          source.path === required || source.path.endsWith(`/${required}`),
      ),
  );

  if (missingSources.length > 0) {
    throw new Error(
      `JavaScript sourcemaps are missing required original source paths:\n${missingSources
        .map((source) => `- ${source}`)
        .join('\n')}`,
    );
  }

  const sourcesWithoutContent = expectedSources.filter((required) =>
    allSources.some(
      (source) =>
        (source.path === required || source.path.endsWith(`/${required}`)) &&
        typeof source.content !== 'string',
    ),
  );
  if (sourcesWithoutContent.length > 0) {
    throw new Error(
      `JavaScript sourcemaps do not embed required original source content:\n${sourcesWithoutContent
        .map((source) => `- ${source}`)
        .join('\n')}`,
    );
  }

  console.log(
    `Verified ${referencedMaps.size} JavaScript sourcemap(s), ${expectedSources.length} required original source paths, and an exact generated-to-original trace position.`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const buildLog = await runProductionBuild();
    await verifySourcemaps(buildLog);
  } catch (error) {
    console.error(`\nSourcemap verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}