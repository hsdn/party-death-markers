
const DefaultColor = 1
const UseJobSpecificMarkers = true

/*
colors: 0 = red, 1 = yellow, 2 = blue

jobs: warrior = 0, lancer = 1, slayer = 2, berserker = 3,
sorcerer = 4, archer = 5, priest = 6, mystic = 7,
reaper = 8, gunner = 9, brawler = 10, ninja = 11,
valkyrie = 12
*/

const JobSpecificMarkers = [
	{
		jobs: [1, 10],
		color: 0
	},
	{
		jobs: [6, 7],
		color: 2
	},
]

module.exports = function PartyDeathMarkers (dispatch) {

	const command = dispatch.command
	let delay = 500
	let enabled = true
	let toparty = false
	let isLeader = false
	let myID = null
	let timer = null
	let sending = false
	let Markers = []
	let RealMarkers = []
	let deadPeople = []
	let partyMembers = []
	
	const UpdateMarkers = () => {
		if(enabled)
		{
			const markers_to_send = (RealMarkers.length ? RealMarkers.concat(Markers) : Markers)
			sending = true
			if(toparty && isLeader)
			{
				dispatch.toServer('C_PARTY_MARKER', 1, {
					markers: markers_to_send
				})
			}
			else
			{
				dispatch.toClient('S_PARTY_MARKER', 1, {
					markers: markers_to_send
				})
			}
			sending = false
		}
	}
	
	const clearMarkerById = (id) => {
		const wasdead = deadPeople.indexOf(id)
		if (wasdead === -1) return;
		//console.log(`dead pos clearing # ${wasdead} for ${String(deadPeople[wasdead])}n`)
		deadPeople.splice(wasdead, 1)
		const mpos = Markers.findIndex((mar) => mar.target === id)
		//console.log(`delete array marker at # ${mpos}`)
		if(mpos !== -1)
		{
			//console.log(`delete array marker for ${String(Markers[mpos].target)}n`)
			Markers.splice(mpos, 1)
			clearTimeout(timer)
			timer = setTimeout(UpdateMarkers, delay)
			//console.log(`clear F: number of marks ${Markers.length}; number of dead ${deadPeople.length}, number of party ${partyMembers.length}`)
			//console.log("DEBUG remove: marker array:")
			//console.log(Markers)
			//console.log("DEBUG remove: dead array:")
			//console.log(deadPeople)
		}
		else
		{
			//console.log("weird stuff, can't find marker for the dead: marker array:")
			//console.log(Markers)
			//console.log("weird stuff, can't find marker for the dead: party array:")
			//console.log(partyMembers)
		}
	}

	const getMarkColor = (jobId) => {
		if (UseJobSpecificMarkers) {
			for (const markers of JobSpecificMarkers) {
				if (markers.jobs.includes(jobId)) {
					return markers.color
				}
			}
		}
		return DefaultColor
	}
	
	command.add('markers', () => {
		enabled = !enabled
		command.message(enabled ? 'Death Markers enabled' : 'Death Markers disabled')
	})
	
	command.add('markers.toparty', () => {
		toparty = !toparty
		command.message(toparty ? 'Death Markers will be visible to all party members (requires leadership)' : 'Only you will be able to see Death Markers')
	})
	
	command.add('delay', (arg) => {
		if(arg)
		{
			delay = parseInt(arg, 10)
			command.message('setting delay to ' + delay)
			//console.log('setting delay to ' + delay)
		}
	})
	
	command.add('upd', () => {
		UpdateMarkers()
		command.message('Update Markers ')
		command.message(`number of marks ${Markers.length}, number of dead ${deadPeople.length}, number of party ${partyMembers.length}`)
		//console.log('Update Markers ')
		//console.log(`UPD: number of marks ${Markers.length}, number of dead ${deadPeople.length}, number of party ${partyMembers.length}`)
	})
	
	const checkLeader = (Id) => {
		if(myID === Id)
		{
			isLeader = true
			if(toparty && enabled)
			{
				command.message('You are the Leader of the party, death Markers will be visible to all party members now')
			}
		}
	}
	
	const DeadOrAlive = ({gameId, alive}) => {
		if(alive)
		{
			//console.log(`someone revived ${String(gameId)}n`)
			clearMarkerById(gameId)
		}
		else
		{
			//console.log(`someone died ${String(gameId)}n`)
			const member = partyMembers.find((memb) => memb.gameId === gameId)
			if (!member) return;
			if (deadPeople.indexOf(gameId) === -1)
			{
				Markers.push({color: getMarkColor(member.class), target: gameId})
				deadPeople.push(gameId)
				//console.log(`new mark for ${member.name}, id: ${String(gameId)}n`)
				//console.log(`number of marks ${Markers.length}, number of dead ${deadPeople.length}, number of party ${partyMembers.length}`)
				//console.log("DEBUG: marker array:")
				//console.log(Markers)
				//console.log("DEBUG: dead array:")
				//console.log(deadPeople)
				clearTimeout(timer)
				setTimeout(UpdateMarkers, delay)
			}
			else
			{
				//console.log("NOTE: Died while already being dead?")
			}
		}
	}
	
	dispatch.hook('S_LOGIN', 14, ({playerId}) => {	
		partyMembers.length = 0
		deadPeople.length = 0
		Markers.length = 0
		isLeader = false
		myID = playerId
    })
	
	dispatch.hook('S_PARTY_MARKER', 1, {order: 100, filter: {fake: null}}, ({markers}) => {
		if(!sending && markers.length)
		{
			RealMarkers = markers
			//console.log("S_PARTY_MARKER")
			//console.log(markers)
		}
    })
	
	dispatch.hook('S_CHANGE_PARTY_MANAGER', 2, ({playerId}) => {
        checkLeader(playerId)
    })
	
	dispatch.hook('S_PARTY_MEMBER_LIST', 9, ({members, leaderPlayerId}) => {
		checkLeader(leaderPlayerId)
		partyMembers = members
		//console.log(`in party with ${partyMembers.length}`)
	})
	
	dispatch.hook('S_SPAWN_ME', 3, DeadOrAlive)
	dispatch.hook('S_SPAWN_USER', 17, DeadOrAlive)
	dispatch.hook('S_CREATURE_LIFE', 3, DeadOrAlive)

	dispatch.hook('S_LEAVE_PARTY_MEMBER', 2, ({playerId}) => {
		//console.log(`was in party with ${partyMembers.length} people, someone left`)
		const mpos = partyMembers.findIndex((memb) => memb.playerId === playerId)
		if (mpos === -1) 
		{
			//console.log("Warning: Party member left, but he was not found in the party before... " + playerId)
			return
		}
		//console.log("S_LEAVE_PARTY_MEMBER " + String(partyMembers[mpos].gameId) + "n")
		clearMarkerById(partyMembers[mpos].gameId)
		partyMembers.splice(mpos, 1)
		//console.log(`now in party with ${partyMembers.length} people, without him`)
	})

	dispatch.hook('S_LEAVE_PARTY', 'raw', () => {
		partyMembers.length = 0
		deadPeople.length = 0
		Markers.length = 0
		isLeader = false
		//console.log("Left the party")
		UpdateMarkers()
	})
}
