/**
 * 为不同说话人自动分配独特的颜色
 * 使用固定的调色板确保每个说话人获得一致的颜色
 */

// 预定义的颜色调色板 - 使用鲜明且易于区分的颜色
const SPEAKER_COLORS = [
  { bg: '#ef4444', text: '#ffffff', name: 'red' },      // 红色
  { bg: '#3b82f6', text: '#ffffff', name: 'blue' },     // 蓝色
  { bg: '#10b981', text: '#ffffff', name: 'green' },    // 绿色
  { bg: '#f59e0b', text: '#ffffff', name: 'orange' },   // 橙色
  { bg: '#8b5cf6', text: '#ffffff', name: 'purple' },   // 紫色
  { bg: '#ec4899', text: '#ffffff', name: 'pink' },     // 粉色
  { bg: '#14b8a6', text: '#ffffff', name: 'teal' },     // 青色
  { bg: '#f97316', text: '#ffffff', name: 'amber' },    // 琥珀色
  { bg: '#6366f1', text: '#ffffff', name: 'indigo' },   // 靛蓝色
  { bg: '#84cc16', text: '#ffffff', name: 'lime' },     // 柠檬绿
];

/**
 * 简单的字符串哈希函数
 * 确保相同的名字总是返回相同的哈希值
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 根据说话人名称或ID获取颜色
 * @param speakerName - 说话人名称（如 "Alice", "Bob", "Speaker 1" 等）
 * @returns 包含背景色和文字颜色的对象
 */
export function getSpeakerColor(speakerName: string): { bg: string; text: string; name: string } {
  // 如果没有名称，返回默认颜色
  if (!speakerName) {
    return SPEAKER_COLORS[0];
  }

  // 使用哈希函数确保相同的名字总是得到相同的颜色
  const hash = hashString(speakerName);
  const colorIndex = hash % SPEAKER_COLORS.length;
  
  return SPEAKER_COLORS[colorIndex];
}

/**
 * 获取所有可用的颜色
 */
export function getAllSpeakerColors() {
  return [...SPEAKER_COLORS];
}

/**
 * 根据索引直接获取颜色（用于按顺序分配）
 * @param index - 索引值
 * @returns 包含背景色和文字颜色的对象
 */
export function getSpeakerColorByIndex(index: number): { bg: string; text: string; name: string } {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

/**
 * 根据说话人名称获取十六进制数字格式颜色（供 3D/Canvas/WebGL 使用）
 * 例如 "Alice" -> 0xef4444
 * @param speakerName - 说话人名称
 * @returns 十六进制数字颜色值
 */
export function getSpeakerColorAsHex(speakerName: string): number {
  const color = getSpeakerColor(speakerName);
  return parseInt(color.bg.replace('#', ''), 16);
}
