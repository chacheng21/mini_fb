package livy;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import config.Config;
/**
 * Hello world!
 *
 */
public class App {
    public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
        LivyClient client = new LivyClientBuilder()
				  .setURI(new URI("http://ec2-34-201-41-33.compute-1.amazonaws.com:8998/"))
				  .build();

		try {
			
			String jar = "livy/target/nets212-hw3-0.0.1-SNAPSHOT.jar";
			
		  System.out.printf("Uploading %s to the Spark context...\n", jar);
		  client.uploadJar(new File(jar)).get();
		  System.out.println("Connected and Running Program");
		  client.submit(new AbsorptionJob()).get();  
		  
		  // String sourceFile = Config.SOCIAL_NET_PATH;
		} finally {
			client.stop(true);
		}
	}
}
