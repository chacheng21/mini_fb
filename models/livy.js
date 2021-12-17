/**
 * Post Spark Job To Livy
 * See: https://axios-http.com/docs/api_intro
 * See: https://livy.incubator.apache.org/docs/latest/rest-api.html
 * Submit via script instead with:
 * /opt/spark/bin/spark-submit --class AbsorptionJob --master http://ec2-52-23-195-173.compute-1.amazonaws.com:8998 livy/target/nets212-hw3-0.0.1-SNAPSHOT.jar
 * curl -H "Content-Type: application/json" -X POST -d ‘<JSON Protocol>’ <livy-host>:<port>/batches
 */
const axios = require('axios');

// Parameters
const remoteJarPath = 's3://livybucket/nets212-hw3-0.0.1-SNAPSHOT.jar'
const ClusterURI = "http://PLACEHOLDER.amazonaws.com:8998"
const ajaxLivyEnabled = false; // to avoid errors due to placeholder

const postLivyJob = function() {
  console.log("Submitting New Job to Livy...");
  if (!ajaxLivyEnabled) return;

  axios({
    method: 'post',
    url: ClusterURI + '/batches',
    data: {
      file: remoteJarPath,
      className: 'livy.AbsorptionJob',
    }
  })
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error);
  });
}

// Export Function if required
module.exports = {'postLivyJob': postLivyJob};

// Call Function if File is Entry Point
if (require.main === module) {
  postLivyJob();
}