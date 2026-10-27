/**
 * Utility functions for mutating PlantUML source code in response to
 * visual viewer interactions (text editing, color changes, arrow styles, skinparams).
 */

function escapeRegex(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Replaces visible text inside PlantUML code.
 * Intelligently checks for quotes, arrow message labels, activity blocks,
 * entity declarations, and general text tokens.
 *
 * @param {string} code - Current PlantUML code
 * @param {string} oldText - Text to replace
 * @param {string} newText - New replacement text
 * @returns {string} Updated PlantUML code
 */
export function replaceTextInUml(code, oldText, newText) {
  if (!code || !oldText || oldText === newText) return code;
  const trimmedOld = oldText.trim();
  const trimmedNew = newText.trim();
  if (!trimmedOld) return code;

  // 1. Quoted text match: e.g. "Web App" -> "Frontend"
  const quotedOld = `"${trimmedOld}"`;
  if (code.includes(quotedOld)) {
    return code.replace(quotedOld, `"${trimmedNew}"`);
  }

  // 2. Single-quoted text match
  const singleQuotedOld = `'${trimmedOld}'`;
  if (code.includes(singleQuotedOld)) {
    return code.replace(singleQuotedOld, `'${trimmedNew}'`);
  }

  // 3. Arrow message label: e.g. ": Hello World" or ":Hello World"
  const arrowLabelRegex = new RegExp(`(:\\s*)${escapeRegex(trimmedOld)}(\\s*$)`, 'm');
  if (arrowLabelRegex.test(code)) {
    return code.replace(arrowLabelRegex, `$1${trimmedNew}$2`);
  }

  // 4. Activity flowchart action: e.g. ":Validate User;"
  const activityRegex = new RegExp(`(:\\s*)${escapeRegex(trimmedOld)}(\\s*;\\s*$)`, 'm');
  if (activityRegex.test(code)) {
    return code.replace(activityRegex, `$1${trimmedNew}$2`);
  }

  // 5. Component / State label: e.g. [Web Browser] or state "Draft"
  const bracketRegex = new RegExp(`(\\[\\s*)${escapeRegex(trimmedOld)}(\\s*\\])`, 'm');
  if (bracketRegex.test(code)) {
    return code.replace(bracketRegex, `$1${trimmedNew}$2`);
  }

  // 6. Entity declaration keyword match:
  // e.g. "actor User", "class Customer", "participant Alice", "state Draft"
  const entityDeclRegex = new RegExp(
    `(^\\s*(?:actor|participant|boundary|control|entity|database|collections|queue|class|interface|abstract|enum|component|state|package|rectangle|node|cloud|usecase)\\s+)` +
    `${escapeRegex(trimmedOld)}(\\b|\\s|$)`,
    'm'
  );
  if (entityDeclRegex.test(code)) {
    // If new text has spaces and old did not, wrap in quotes
    const replacement = trimmedNew.includes(' ') ? `"${trimmedNew}"` : trimmedNew;
    return code.replace(entityDeclRegex, `$1${replacement}$2`);
  }

  // 7. Word boundary match
  const wordRegex = new RegExp(`\\b${escapeRegex(trimmedOld)}\\b`, 'm');
  if (wordRegex.test(code)) {
    return code.replace(wordRegex, trimmedNew);
  }

  // 8. General fallback replacement
  return code.replace(trimmedOld, trimmedNew);
}

/**
 * Updates or sets the background/fill color of an entity (box, class, participant) in PlantUML.
 *
 * @param {string} code
 * @param {string} elementName
 * @param {string} hexColor - e.g. "#DDF4FF" or "none" to remove
 * @returns {string} Updated PlantUML code
 */
export function setElementColorInUml(code, elementName, hexColor) {
  const cleanName = elementName.trim();
  const isClear = !hexColor || hexColor === 'none' || hexColor === 'default';
  const cleanHex = isClear ? '' : (hexColor.startsWith('#') ? hexColor : `#${hexColor}`);

  const namePattern = cleanName.includes(' ')
    ? `"${escapeRegex(cleanName)}"`
    : `("${escapeRegex(cleanName)}"|\\b${escapeRegex(cleanName)}\\b)`;

  // Match: keyword Name [as Alias] [#ExistingColor]
  const declRegex = new RegExp(
    `^(\\s*(?:actor|participant|boundary|control|entity|database|collections|queue|class|interface|abstract|enum|component|state|package|rectangle|node|cloud|usecase)\\s+${namePattern}(?:\\s+as\\s+\\w+)?)(?:\\s*#[0-9a-fA-F]{3,8}|\\s*#[a-zA-Z]+)?`,
    'm'
  );

  if (declRegex.test(code)) {
    return code.replace(declRegex, isClear ? '$1' : `$1 ${cleanHex}`);
  }

  // If entity is not declared yet (e.g. bare "Alice -> Bob"), insert participant declaration
  if (!isClear) {
    const safeName = cleanName.includes(' ') ? `"${cleanName}"` : cleanName;
    const declLine = `participant ${safeName} ${cleanHex}`;
    const startRegex = /^(@start[a-z0-9_-]+.*$)/m;
    if (startRegex.test(code)) {
      return code.replace(startRegex, `$1\n${declLine}`);
    } else {
      return `${declLine}\n${code}`;
    }
  }

  return code;
}

/**
 * Updates the color of an arrow in the diagram.
 * e.g. "Alice -> Bob" becomes "Alice -[#0969da]-> Bob".
 *
 * @param {string} code
 * @param {string} arrowTextOrLine - Message or snippet identifying the arrow
 * @param {string} hexColor - e.g. "#0969da" or "none"
 * @returns {string} Updated code
 */
export function setArrowColorInUml(code, arrowTextOrLine, hexColor) {
  const isClear = !hexColor || hexColor === 'none' || hexColor === 'default';
  const cleanHex = isClear ? '' : (hexColor.startsWith('#') ? hexColor : `#${hexColor}`);
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(arrowTextOrLine) && /(->|-->|<-|<--|<->|<-->)/.test(line)) {
      if (isClear) {
        // Strip existing color e.g. -[#0969da]-> to ->
        lines[i] = line
          .replace(/-\[[^\]]+\]-->/g, '-->')
          .replace(/-\[[^\]]+\]->/g, '->')
          .replace(/<--\[[^\]]+\]-/g, '<--')
          .replace(/<-\[[^\]]+\]-/g, '<-');
      } else {
        if (/-\[[^\]]+\]-->/.test(line)) {
          lines[i] = line.replace(/-\[[^\]]+\]-->/, `-[${cleanHex}]-->`);
        } else if (/-\[[^\]]+\]->/.test(line)) {
          lines[i] = line.replace(/-\[[^\]]+\]->/, `-[${cleanHex}]->`);
        } else if (/-->/.test(line)) {
          lines[i] = line.replace(/-->/, `-[${cleanHex}]-->`);
        } else if (/->/.test(line)) {
          lines[i] = line.replace(/->/, `-[${cleanHex}]->`);
        } else if (/<--/.test(line)) {
          lines[i] = line.replace(/<--/, `<--[${cleanHex}]-`);
        } else if (/<-/.test(line)) {
          lines[i] = line.replace(/<-/, `<-[${cleanHex}]-`);
        }
      }
      return lines.join('\n');
    }
  }

  return code;
}

/**
 * Changes arrow line style (solid, dashed, bidirectional, reverse).
 *
 * @param {string} code
 * @param {string} arrowTextOrLine
 * @param {'solid' | 'dashed' | 'bidi' | 'reverse'} newStyle
 * @returns {string}
 */
export function setArrowStyleInUml(code, arrowTextOrLine, newStyle) {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(arrowTextOrLine) && /(->|-->|<-|<--|<->|<-->)/.test(line)) {
      // Preserve any color attribute inside arrow, e.g. -[#123]->
      const colorMatch = line.match(/-(\[[^\]]+\])->/);
      const colorPart = colorMatch ? colorMatch[1] : '';

      if (newStyle === 'solid') {
        lines[i] = line.replace(/(?:<--|<-|<->|<-->|-->|->)/, colorPart ? `-${colorPart}->` : '->');
      } else if (newStyle === 'dashed') {
        lines[i] = line.replace(/(?:<--|<-|<->|<-->|-->|->)/, colorPart ? `-${colorPart}-->` : '-->');
      } else if (newStyle === 'bidi') {
        lines[i] = line.replace(/(?:<--|<-|<->|<-->|-->|->)/, '<->');
      } else if (newStyle === 'reverse') {
        lines[i] = line.replace(/(?:<--|<-|<->|<-->|-->|->)/, '<-');
      }
      return lines.join('\n');
    }
  }
  return code;
}

/**
 * Injects a note next to an element in the diagram.
 *
 * @param {string} code
 * @param {string} elementName
 * @param {string} noteText
 * @returns {string}
 */
export function addNoteToElementInUml(code, elementName, noteText) {
  const cleanName = elementName.trim();
  const cleanNote = noteText.trim();
  if (!cleanName || !cleanNote) return code;

  const noteLine = `note right of ${cleanName.includes(' ') ? `"${cleanName}"` : cleanName}: ${cleanNote}`;
  const lines = code.split('\n');

  // Insert right after occurrence of elementName
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(cleanName)) {
      lines.splice(i + 1, 0, noteLine);
      return lines.join('\n');
    }
  }

  // Fallback: append before @enduml
  const endIdx = lines.findIndex(l => /^@end/i.test(l));
  if (endIdx !== -1) {
    lines.splice(endIdx, 0, noteLine);
  } else {
    lines.push(noteLine);
  }
  return lines.join('\n');
}

/**
 * Toggles or updates a global skinparam in the PlantUML source.
 *
 * @param {string} code
 * @param {string} paramKey - e.g. "handwritten", "monochrome", "roundcorner"
 * @param {string} paramVal - e.g. "true", "12"
 * @param {boolean} enable - Whether to enable or remove
 * @returns {string}
 */
export function toggleSkinparamInUml(code, paramKey, paramVal, enable = true) {
  const lines = code.split('\n');
  const paramRegex = new RegExp(`^\\s*skinparam\\s+${escapeRegex(paramKey)}\\b.*$`, 'i');
  const existingIdx = lines.findIndex(l => paramRegex.test(l));

  if (enable) {
    const newLine = `skinparam ${paramKey} ${paramVal}`;
    if (existingIdx !== -1) {
      lines[existingIdx] = newLine;
    } else {
      const startIdx = lines.findIndex(l => /^@start/i.test(l));
      if (startIdx !== -1) {
        lines.splice(startIdx + 1, 0, newLine);
      } else {
        lines.unshift(newLine);
      }
    }
  } else {
    if (existingIdx !== -1) {
      lines.splice(existingIdx, 1);
    }
  }
  return lines.join('\n');
}

/**
 * Checks whether a specific skinparam is currently enabled in the code.
 *
 * @param {string} code
 * @param {string} paramKey
 * @param {string} [paramVal]
 * @returns {boolean}
 */
export function hasSkinparam(code, paramKey, paramVal) {
  if (!code) return false;
  const regex = paramVal
    ? new RegExp(`^\\s*skinparam\\s+${escapeRegex(paramKey)}\\s+${escapeRegex(paramVal)}\\b`, 'im')
    : new RegExp(`^\\s*skinparam\\s+${escapeRegex(paramKey)}\\b`, 'im');
  return regex.test(code);
}
