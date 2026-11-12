'use strict';

import { tKey } from '../i18n/index.js';

export function teamRoleLabel(role) {
  return ({
    owner: tKey("owner"),
    admin: tKey("administrator.2"),
    publisher: tKey("publisher.2"),
    designer: tKey("designer.2"),
    builder: tKey("team.role.builder"),
    modeler: tKey("team.role.modeler"),
    member: tKey("member.2")
  })[role] || role;
}
