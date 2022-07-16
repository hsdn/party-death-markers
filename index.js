
const DefaultColor = 1;
const UseJobSpecificMarkers = true;

/*
colors: 0 = red, 1 = yellow, 2 = blue

jobs: warrior = 0, lancer = 1, slayer = 2, berserker = 3,
sorcerer = 4, archer = 5, priest = 6, mystic = 7,
reaper = 8, gunner = 9, brawler = 10, ninja = 11,
valkyrie = 12
*/

const JobSpecificMarkers = [
	{
		"jobs": [1, 10],
		"color": 0
	},
	{
		"jobs": [6, 7],
		"color": 2
	}
];

module.exports = function PartyDeathMarkers(dispatch) {

	const command = dispatch.command;
	let delay = 500;
	let enabled = true;
	let toparty = false;
	let isLeader = false;
	let myID = null;
	let timer = null;
	let sending = false;
	const Markers = [];
	let realMarkers = [];
	const deadPeople = [];
	let partyMembers = [];

	const UpdateMarkers = () => {
		if (enabled) {
			const markers_to_send = (realMarkers.length ? realMarkers.concat(Markers) : Markers);
			sending = true;
			if (toparty && isLeader) {
				dispatch.toServer("C_PARTY_MARKER", 1, {
					"markers": markers_to_send
				});
			} else {
				dispatch.toClient("S_PARTY_MARKER", 1, {
					"markers": markers_to_send
				});
			}
			sending = false;
		}
	};

	const clearMarkerById = (id) => {
		const wasdead = deadPeople.indexOf(id);
		if (wasdead === -1) return;
		deadPeople.splice(wasdead, 1);
		const mpos = Markers.findIndex((mar) => mar.target === id);
		if (mpos !== -1) {
			Markers.splice(mpos, 1);
			clearTimeout(timer);
			timer = setTimeout(UpdateMarkers, delay);
		}
	};

	const getMarkColor = (jobId) => {
		if (UseJobSpecificMarkers) {
			for (const markers of JobSpecificMarkers) {
				if (markers.jobs.includes(jobId)) {
					return markers.color;
				}
			}
		}
		return DefaultColor;
	};

	command.add("markers", () => {
		enabled = !enabled;
		command.message(enabled ? "Death Markers enabled" : "Death Markers disabled");
	});

	command.add("markers.toparty", () => {
		toparty = !toparty;
		command.message(toparty ? "Death Markers will be visible to all party members (requires leadership)" : "Only you will be able to see Death Markers");
	});

	command.add("delay", (arg) => {
		if (arg) {
			delay = parseInt(arg, 10);
			command.message(`setting delay to ${ delay}`);
		}
	});

	command.add("upd", () => {
		UpdateMarkers();
		command.message("Update Markers ");
		command.message(`number of marks ${Markers.length}, number of dead ${deadPeople.length}, number of party ${partyMembers.length}`);
	});

	const checkLeader = (Id) => {
		if (myID === Id) {
			isLeader = true;
			if (toparty && enabled) {
				command.message("You are the Leader of the party, death Markers will be visible to all party members now");
			}
		}
	};

	const DeadOrAlive = ({ gameId, alive }) => {
		if (alive) {
			clearMarkerById(gameId);
		} else {
			const member = partyMembers.find((memb) => memb.gameId === gameId);
			if (!member) return;
			if (deadPeople.indexOf(gameId) === -1) {
				Markers.push({ "color": getMarkColor(member.class), "target": gameId });
				deadPeople.push(gameId);
				clearTimeout(timer);
				setTimeout(UpdateMarkers, delay);
			}
		}
	};

	dispatch.hook("S_LOGIN", dispatch.majorPatchVersion >= 114 ? 15 : 14, ({ playerId }) => {
		partyMembers.length = 0;
		deadPeople.length = 0;
		Markers.length = 0;
		isLeader = false;
		myID = playerId;
	});

	dispatch.hook("S_PARTY_MARKER", 1, { "order": 100, "filter": { "fake": null } }, ({ markers }) => {
		if (!sending && markers.length) {
			realMarkers = markers;
		}
	});

	dispatch.hook("S_CHANGE_PARTY_MANAGER", 2, ({ playerId }) => {
		checkLeader(playerId);
	});

	dispatch.hook("S_PARTY_MEMBER_LIST", dispatch.majorPatchVersion >= 69 ? 8 : 7, (event) => {
		checkLeader(event.leaderPlayerId || event.leader.playerId);
		partyMembers = event.members;
	});

	dispatch.hook("S_SPAWN_ME", 3, DeadOrAlive);
	dispatch.hook("S_SPAWN_USER", dispatch.majorPatchVersion >= 99 ? 17 : 15, DeadOrAlive);
	dispatch.hook("S_CREATURE_LIFE", 3, DeadOrAlive);

	dispatch.hook("S_LEAVE_PARTY_MEMBER", 2, ({ playerId }) => {
		const mpos = partyMembers.findIndex((memb) => memb.playerId === playerId);
		if (mpos === -1) {
			return;
		}
		clearMarkerById(partyMembers[mpos].gameId);
		partyMembers.splice(mpos, 1);
	});

	dispatch.hook("S_LEAVE_PARTY", "raw", () => {
		partyMembers.length = 0;
		deadPeople.length = 0;
		Markers.length = 0;
		isLeader = false;
		UpdateMarkers();
	});
};