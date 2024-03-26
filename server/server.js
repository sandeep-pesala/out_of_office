const axios = require("axios");
const base64 = require("base-64");
const luxon = require("luxon");
var extend = require("extend");

exports = {

  getDb: function(date, callback) {
    $db.get(date).then(
      function(data) {
        console.log("data", data);
        callback(null, data);
      },
      function(error) {
        console.log(error);
        callback(error, null);
      }
    );
  },

  setDb: function(id) {
    $db.set(`conversation:${id}`, { conversation: id }).then(
      function(data) {
        console.log(data);
      },
      function(error) {
        console.log("Log: error", error);
      }
    );
  },

  getAgent: function(agentId, callback) {
    axios
      .get(`/api/v2/agents/${agentId}`)
      .then(function(rtnData) {
        callback(null, rtnData.data);
      })
      .catch(function(error) {
        console.error(error);
        callback(error, null);
      });
  },

  getTicket: function(ticketId, callback) {
    console.log("Log: ticketId", ticketId);
    axios
      .get(`/api/v2/tickets/${ticketId}?include=requester`)
      .then(function(rtnData) {
        if (rtnData.data.ticket.responder_id) {
          var result = {};
          result.ticketData = rtnData.data;
          console.log("Log: responder id", rtnData.data.ticket.responder_id);
          exports.getAgent(rtnData.data.ticket.responder_id, function(err, agentdata) {
            if (err) {
              callback(null, result);
            } else {
              result.agentData = agentdata.agent;
              callback(null, result);
            }
          });
        } else {
          callback(null, rtnData.data);
        }
      })
      .catch(function(error) {
        console.error(error);
        callback(error, null);
      });
  },

  onTicketUpdateCreateHandler: function(args) {
    // Do the long job
    // Check if agent assigned
    if (args.data.ticket.responder_id) {
      exports.getDb("iparam", function(error, iparamsfromdb) {
        if (error) {
          console.error(error);
          return;
        }
        console.log("argsInCreateTicket", args)
        let workspaceId = args.data.ticket.workspace_id;
        console.log("iparamsfromdb", iparamsfromdb)
        let configFromDb = iparamsfromdb.ws_configurations ? iparamsfromdb.ws_configurations[workspaceId] : iparamsfromdb;
        args.iparams = extend(args.iparams, configFromDb);
        exports.handleOOO(args, args.data.ticket.responder_id);
      });
    } else {
      console.log("Not Performing any actions as there is no agent in this ticket.");
    }
  },

  handleOOO: function(args, agentid, ticketinfo) {
    exports.getDb(agentid, function(error, data) {
      console.log("handleOooData", data)
      if (!error) {
        var isCreatedTimeFallsinLeave = false;
        data.leaves.forEach(leave => {
          leave.fromdate = luxon.DateTime.fromISO(leave.fromdate);
          leave.todate = luxon.DateTime.fromISO(leave.todate);
          // eslint-disable-next-line camelcase
          var updated_at = luxon.DateTime.fromISO(ticketinfo ? args.data.conversation.updated_at : args.data.ticket.updated_at);
          // eslint-disable-next-line camelcase
          if (!isCreatedTimeFallsinLeave && leave.todate > updated_at && leave.fromdate < updated_at) {
            isCreatedTimeFallsinLeave = luxon.Interval.fromDateTimes(leave.fromdate, leave.todate).contains(updated_at);
            // do the OOO action based on iparam
            if ((!ticketinfo && args.iparams.unassignticket) || args.iparams.reassigntickettogroup) {
              // update ticket api call
              updateTicket(args, args.data.ticket.id);
            } else if (args.iparams.sendooonotification && ticketinfo) {
              ticketinfo.domain = args.domain;
              createaReply(args, ticketinfo);
            }
          }
        });
      } else {
        console.error(`${agentid} hasn't applied any leave yet.`);
      }
    });
  },

  onConversationCreateCallback: function(args) {
    exports.getDb("iparam", function(error, iparamsfromdb) {
      if (error) {
        console.error(error);
        return;
      }
      let workspaceId = args.data.ticket.workspace_id;
      let configFromDb = iparamsfromdb.ws_configurations ? iparamsfromdb.ws_configurations[workspaceId] : iparamsfromdb;
      args.iparams = extend(args.iparams, configFromDb);
      initaxios(args);
      exports.getDb(`conversation:${args.data.conversation.id}`, function(err) {
        if (!err) {
          $db.delete(`conversation:${args.data.conversation.id}`);
        } else {
          exports.handleConversationCreate(args);
        }
      });
    });
  },

  handleConversationCreate: function(args) {
    exports.getTicket(args.data.conversation.ticket_id, function(err, result) {
      console.log("Log: result", result);
      if (!err && result.ticketData.ticket.responder_id && result.agentData) {
        exports.handleOOO(args, result.ticketData.ticket.responder_id, result);
      }
    });
  }
};

// use this method to update the ticket properties
function updateTicket(args, ticketId) {
  initaxios(args);
  // replace the plaeholders
  var body = {
    // eslint-disable-next-line camelcase
    group_id: args.iparams.unassignticket ? null : 0,
    // eslint-disable-next-line camelcase
    responder_id: args.iparams.unassignticket ? null : 0
  };
  if (args.iparams.reassigntickettogroup) {
    // eslint-disable-next-line camelcase
    (body.group_id = Number(args.iparams.assignedgroup)), 
    
    // eslint-disable-next-line camelcase
    (body.responder_id = Number(args.iparams.assignedagent) <= 0 ? null : Number(args.iparams.assignedagent));
  }
  
  console.log("Log: updateTicket -> body", body);
  axios
    .put(`/api/v2/tickets/${ticketId}?bypass_mandatory=true`, body)
    .then(function(rtnData) {
      console.log("rtnData", rtnData.data);
    })
    .catch(function(error) {
      console.error(error.response);
    });
}

// use this method to create a reply to the ticket.
function createaReply(args, ticket) {
  initaxios(args);
  // replace the plaeholders
  var html = replaceplaceholders(args.iparams.emailbody, ticket);
  axios
    .post(`/api/v2/tickets/${ticket.ticketData.ticket.id}/reply`, {
      body: html
    })
    .then(function(rtnData) {
      console.log(rtnData.data);
      exports.setDb(rtnData.data.conversation.id);
    })
    .catch(function(error) {
      console.error(error);
    });
}

function replaceplaceholders(text, payload) {
  console.log("Log: replaceplaceholders -> payload", JSON.stringify(payload));
  var rtnval = "";
  try {
    rtnval = text
      .replaceAll("{{ticket.agent.name}}", payload.agentData.first_name + " " + payload.agentData.last_name)
      .replaceAll("{{ticket.agent.email}}", payload.agentData.email)
      .replaceAll("{{ticket.id}}", payload.ticketData.ticket.id)
      .replaceAll("{{ticket.url}}", `https://${payload.domain}/helpdesk/tickets/${payload.ticketData.ticket.id}`)
      .replaceAll("{{helpdesk_name}}", payload.domain)
      .replaceAll("{{ticket.requester.name}}", payload.ticketData.ticket.requester.name)
      .replaceAll("{{ticket.requester.email}}", payload.ticketData.ticket.requester.email)
      .replaceAll("{{ticket.from_email}}", payload.ticketData.ticket.requester.email);
  } catch (err) {
    console.error(err);
  }
  return rtnval;
}

function initaxios(args) {
  axios.defaults.baseURL = "https://" + args.iparams.domain;
  axios.defaults.headers.common["Authorization"] = "Basic " + base64.encode(args.iparams.api_key + ":*");
}

String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, "g"), replacement);
};
