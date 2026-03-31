// GET /api/asana-tasks?projectGid=<gid>
// Returns: { project, sections, tasks }
//
// Proxies Asana API calls to fetch project tasks with date ranges.
// Requires ASANA_PAT environment variable (Personal Access Token).

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pat = process.env.ASANA_PAT;
  if (!pat) {
    return res.status(503).json({ error: 'Asana integration is not configured. Set the ASANA_PAT environment variable.' });
  }

  const { projectGid } = req.query;
  if (!projectGid || !/^\d+$/.test(projectGid)) {
    return res.status(400).json({ error: 'Missing or invalid projectGid parameter' });
  }

  const headers = {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/json'
  };

  try {
    // Fetch project info
    const projectResp = await fetch(
      `https://app.asana.com/api/1.0/projects/${projectGid}?opt_fields=name,start_on,due_on`,
      { headers }
    );
    if (!projectResp.ok) {
      const errText = await projectResp.text();
      throw new Error(`Asana project error ${projectResp.status}: ${errText}`);
    }
    const projectData = await projectResp.json();

    // Fetch sections
    const sectionsResp = await fetch(
      `https://app.asana.com/api/1.0/projects/${projectGid}/sections?opt_fields=name&limit=100`,
      { headers }
    );
    if (!sectionsResp.ok) {
      const errText = await sectionsResp.text();
      throw new Error(`Asana sections error ${sectionsResp.status}: ${errText}`);
    }
    const sectionsData = await sectionsResp.json();

    // Fetch all tasks with pagination
    const taskFields = 'name,start_on,due_on,completed,completed_at,assignee.name,memberships.section.name,memberships.section.gid';
    let allTasks = [];
    let offset = null;
    do {
      const url = new URL('https://app.asana.com/api/1.0/tasks');
      url.searchParams.set('project', projectGid);
      url.searchParams.set('opt_fields', taskFields);
      url.searchParams.set('limit', '100');
      if (offset) url.searchParams.set('offset', offset);

      const tasksResp = await fetch(url.toString(), { headers });
      if (!tasksResp.ok) {
        const errText = await tasksResp.text();
        throw new Error(`Asana tasks error ${tasksResp.status}: ${errText}`);
      }
      const tasksData = await tasksResp.json();
      allTasks = allTasks.concat(tasksData.data || []);
      offset = tasksData.next_page?.offset || null;
    } while (offset);

    return res.status(200).json({
      project: projectData.data,
      sections: sectionsData.data,
      tasks: allTasks
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
