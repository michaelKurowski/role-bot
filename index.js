const Discord = require('discord.js');
const _ = require('lodash')
require('dotenv').config()
const roles = require('./roles.json')
const roleMessageIdsList = process.env.ROLE_MESSAGE_IDS.split(' ')
const SERVER_NAME = process.env.SERVER_NAME
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
client.login(process.env.TOKEN);




client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  const guildEntry = [...client.guilds.cache].find(([guildId, guild]) => guild.name === SERVER_NAME)
  if (!guildEntry) {
    console.error('ERROR! Bot couldn\'t find its server by name')
    process.exit(1)
  }
  const guild = guildEntry[1]

  roles.forEach(roleEntry => {
    const foundRole = [...guild.roles.cache].find(([roleId, role]) => role.name === roleEntry.role)
    if (!foundRole) {
      console.warn('Config entry in roles.json ', roleEntry, ' couldn\'t find relevelant role on the server')
    }

    const foundEmoji = [...guild.emojis.cache].find(([emojiId, emoji]) => emoji.name === roleEntry.emoji)
    if (!foundEmoji) {
      console.warn('Config entry in roles.json ', roleEntry, ' couldn\'t find relevelant emoji on the server')
    }
  })
});
 

client.on('messageReactionRemove', async (reaction, user) => {
  let result
  try {
    result = await pullRoleManagementData(reaction, user)
  } catch (err) {
    console.warn(err)
    return
  }
  const { member, role } = result
  console.log(`Removing role ${role.name} from ${member.user.username}`)
  member.roles.remove(role).catch(err => console.error(err))
})

client.on('messageReactionAdd', async (reaction, user) => {
  let result
  try {
    result = await pullRoleManagementData(reaction, user)
  } catch (err) {
    console.warn(err)
    return
  }
  const { member, role } = result

  console.log(`Adding role ${role.name} to ${member.user.username}`)
  member.roles.add(role).catch(err => console.error(err))
});


async function pullRoleManagementData(reaction, user) {
  const message = await getMessageFromReaction(reaction)
  if (!message) throw new Error('Failed to pull message')
  if (!isMessageIdWhitelisted(message.id)) throw new Error(`Message ID ${message.id} does not match the whitelisted messages: ${process.env.ROLE_MESSAGE_IDS}`)

  const member = await getMemberFromUser(user, message.guild)
  if (!member) throw new Error('Failed to pull member')

  const emoji = reaction._emoji.name
  const role = await mapEmojiToRole(message, emoji)
  if (!role) throw new Error('Failed to pull role for emoji', emoji)
  return { member, role }
}

function isMessageIdWhitelisted(messageId) {
  return roleMessageIdsList.includes(messageId)
}

async function getMemberFromUser(user, guild) {
  let member = guild.members.cache.get(user.id)
  if (!member) {
    member = guild.members.fetch({ user, force: true })
  }
  if (!member) {
    console.error('Cannot map user to member')
    return
  }
  return member
}

async function getMessageFromReaction(reaction) {
	if (reaction.partial) {
		try {
			messageReaction = await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message: ', error);
			return;
		}
  }
  return reaction.message

}

async function mapEmojiToRole(message, emoji) {
  const match = roles.find(role => role.emoji === emoji)
  if (!match) {
    return null
  }
  const roleName = match.role
  const serverCachedRoles = message.guild.roles
  let roleEntry = [...serverCachedRoles.cache].find(([roleId, role]) => role.name === roleName)
  const role = roleEntry && roleEntry[1]
  if (role) return role
  try {
    role = message.guild.roles.find(role => role.name === roleName)
  } catch (err) {
    console.log('Failed to match a role')
    return null
  }
  if (!role) return null

  return role
}

