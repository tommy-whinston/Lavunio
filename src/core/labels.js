'use strict';

export function teamRoleLabel(role) {
  return ({
    owner: 'владелец',
    admin: 'администратор',
    publisher: 'публикатор',
    designer: 'дизайнер',
    member: 'участник'
  })[role] || role;
}
