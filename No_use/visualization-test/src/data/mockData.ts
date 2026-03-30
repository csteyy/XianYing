export interface NodeData {
  id: string;
  name: string;
  val: number; // 节点大小/影响力
  color: string;
  mood: string;
  group?: number;
}

export interface LinkData {
  source: string;
  target: string;
  value: number; // 互动频率
  mood: string;
  meetingId: string;
  timestamp: number;
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

const colors = [
  '#f59e0b', // 橙色
  '#3b82f6', // 蓝色
  '#22c55e', // 绿色
  '#8b5cf6', // 紫色
  '#ef4444', // 红色
  '#06b6d4', // 青色
  '#ec4899', // 粉红
];

const moods = ['积极', '平静', '消极', '好奇', '困惑', '顿悟'];

// 生成随机数据
function generateComplexData(): GraphData {
  const nodes: NodeData[] = [];
  const links: LinkData[] = [];
  
  // 生成 20 个参与者节点
  const names = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 
    'Frank', 'Grace', 'Hank', 'Ivy', 'Jack', 
    'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 
    'Paul', 'Quinn', 'Rachel', 'Sam', 'Tom'
  ];

  names.forEach((name, i) => {
    nodes.push({
      id: name,
      name: name,
      val: Math.floor(Math.random() * 20) + 5, // 5~25
      color: colors[Math.floor(Math.random() * colors.length)],
      mood: moods[Math.floor(Math.random() * moods.length)],
      group: Math.floor(i / 5) // 4 groups
    });
  });

  const meetings = ['meeting-1', 'meeting-2', 'meeting-3'];

  // 生成 80 条互动连线
  for (let i = 0; i < 80; i++) {
    const sourceIndex = Math.floor(Math.random() * nodes.length);
    let targetIndex = Math.floor(Math.random() * nodes.length);
    while (targetIndex === sourceIndex) {
      targetIndex = Math.floor(Math.random() * nodes.length);
    }
    
    // 生成一些局部聚集的边
    if (Math.random() > 0.3) {
      // 70% 的概率尝试找同组的
      const sameGroupNodes = nodes.filter((n, idx) => n.group === nodes[sourceIndex].group && idx !== sourceIndex);
      if (sameGroupNodes.length > 0) {
        targetIndex = nodes.indexOf(sameGroupNodes[Math.floor(Math.random() * sameGroupNodes.length)]);
      }
    }

    links.push({
      source: nodes[sourceIndex].id,
      target: nodes[targetIndex].id,
      value: Math.floor(Math.random() * 5) + 1, // 1~5
      mood: moods[Math.floor(Math.random() * moods.length)],
      meetingId: meetings[Math.floor(Math.random() * meetings.length)],
      timestamp: Date.now() - Math.floor(Math.random() * 10000000)
    });
  }

  return { nodes, links };
}

export const complexMockData = generateComplexData();
export const allMeetings = ['meeting-1', 'meeting-2', 'meeting-3'];
