package config;

/**
 * Global configuration for NETS 212 homeworks.
 * 
 * A better version of this would read a config file from the resources,
 * such as a YAML file.  But our first version is designed to be simple
 * and minimal. 
 * 
 * @author zives
 *
 */
public class Config {

	/**
	 * The path to the space-delimited social network data
	 */
	public static String NEWS_ARTICLE_PATH = "s3a://penn-cis545-files/News_Category_Dataset_v2.json";
	// public static String NEWS_ARTICLE_PATH = "livy/articles.json";
		
	public static String LOCAL_SPARK = "local[*]";

	/**
	 * How many RDD partitions to use?
	 */
	public static int PARTITIONS = 5;

	/* 
	 * DynamoDB Stuff
	 */

	/**
	 * If we set up a local DynamoDB server, where does it listen?
	 */
	public static int DYNAMODB_LOCAL_PORT = 8000;

	/**
	 * This is the connection to the DynamoDB server. For MS1, please
	 * keep this as http://localhost:8000; for MS2; you should replace it
	 * with https://dynamodb.us-east-1.amazonaws.com. 
	 */
	public static String DYNAMODB_URL = "https://dynamodb.us-east-1.amazonaws.com";
	
	
	/**
	 * Do we want to use the local DynamoDB instance or a remote one?
	 * 
	 * If we are local, performance is really slow - so you should switch
	 * to the real thing as soon as basic functionality is in place.
	 */
	public static Boolean LOCAL_DB = false;
	
}

